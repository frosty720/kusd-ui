import { afterEach, describe, expect, it, vi } from "vitest";
import {
  amountWithinCorridorLimits,
  buildDepositSource,
  channelTypeLabel,
  countryDisplayName,
  dedupeNetworksByName,
  fetchRampQuote,
  isEvmAddress,
  isTerminalDepositState,
  isValidLocalAmount,
  isValidMomoNumber,
  makeIdempotencyKey,
  RampApiError,
  sourceAccountTypeFor,
} from "../ramp";

describe("isEvmAddress", () => {
  it("accepts a checksummed address", () => {
    expect(isEvmAddress("0xfF409DBD66bD013385c41cb55D8cD90902BB4c80")).toBe(
      true,
    );
  });
  it("accepts lowercase and trims whitespace", () => {
    expect(isEvmAddress("  0xff409dbd66bd013385c41cb55d8cd90902bb4c80 ")).toBe(
      true,
    );
  });
  it("rejects wrong length, missing prefix, and garbage", () => {
    expect(isEvmAddress("0xfF409DBD66bD013385c41cb55D8cD90902BB4c8")).toBe(
      false,
    );
    expect(isEvmAddress("fF409DBD66bD013385c41cb55D8cD90902BB4c80")).toBe(
      false,
    );
    expect(isEvmAddress("not an address")).toBe(false);
    expect(isEvmAddress("")).toBe(false);
  });
});

describe("isValidLocalAmount", () => {
  it("accepts integers and decimals", () => {
    expect(isValidLocalAmount("25000")).toBe(true);
    expect(isValidLocalAmount("25000.50")).toBe(true);
  });
  it("rejects zero, negatives, and non-numeric input", () => {
    expect(isValidLocalAmount("0")).toBe(false);
    expect(isValidLocalAmount("-5")).toBe(false);
    expect(isValidLocalAmount("1e5")).toBe(false);
    expect(isValidLocalAmount("25,000")).toBe(false);
    expect(isValidLocalAmount("")).toBe(false);
  });
});

describe("makeIdempotencyKey", () => {
  it("embeds the wallet fragment and is unique per call", () => {
    const wallet = "0xfF409DBD66bD013385c41cb55D8cD90902BB4c80";
    const a = makeIdempotencyKey(wallet);
    const b = makeIdempotencyKey(wallet);
    expect(a).toContain("ff409dbd");
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8); // keeper requires min 8 chars
  });
});

describe("sourceAccountTypeFor", () => {
  it("maps momo to momo and every other rail to bank", () => {
    expect(sourceAccountTypeFor("momo")).toBe("momo");
    expect(sourceAccountTypeFor("bank")).toBe("bank");
    // NG's NGN deposit rail is p2p but the payer still uses a bank account.
    expect(sourceAccountTypeFor("p2p")).toBe("bank");
  });
});

describe("channelTypeLabel", () => {
  it("labels rails for users", () => {
    expect(channelTypeLabel("momo")).toBe("mobile money");
    expect(channelTypeLabel("bank")).toBe("bank transfer");
    expect(channelTypeLabel("p2p")).toBe("bank transfer");
  });
});

describe("countryDisplayName", () => {
  it("resolves ISO codes via Intl without a hardcoded list", () => {
    expect(countryDisplayName("NG")).toBe("Nigeria");
    expect(countryDisplayName("CM")).toBe("Cameroon");
  });
  it("falls back to the code for unknown or invalid input", () => {
    // XQ is unassigned in ISO 3166 — CLDR has no name for it. (ZZ is not a
    // good probe: CLDR genuinely names it "Unknown Region".)
    expect(countryDisplayName("XQ")).toBe("XQ");
    expect(countryDisplayName("not-a-code")).toBe("not-a-code");
  });
});

describe("amountWithinCorridorLimits", () => {
  it("enforces min and max when both are set", () => {
    const c = { min: 2500, max: 5000000 };
    expect(amountWithinCorridorLimits("2500", c)).toBe(true);
    expect(amountWithinCorridorLimits("2499", c)).toBe(false);
    expect(amountWithinCorridorLimits("5000000", c)).toBe(true);
    expect(amountWithinCorridorLimits("5000001", c)).toBe(false);
  });
  it("treats 0 and null bounds as no limit (Yellow Card uses 0 for none)", () => {
    expect(amountWithinCorridorLimits("999999999", { min: 150, max: 0 })).toBe(
      true,
    );
    expect(amountWithinCorridorLimits("1", { min: 0, max: null })).toBe(true);
  });
  it("rejects non-numeric input", () => {
    expect(amountWithinCorridorLimits("abc", { min: null, max: null })).toBe(
      false,
    );
  });
});

describe("isValidMomoNumber", () => {
  it("accepts digit strings with optional + and common separators", () => {
    expect(isValidMomoNumber("+2348012345678")).toBe(true);
    expect(isValidMomoNumber("0801 234 5678")).toBe(true);
    expect(isValidMomoNumber("+237 6XX".replace("6XX", "677889900"))).toBe(
      true,
    );
    expect(isValidMomoNumber("1111111111")).toBe(true); // YC sandbox success number
  });
  it("rejects too-short, too-long, and non-numeric input", () => {
    expect(isValidMomoNumber("12345")).toBe(false);
    expect(isValidMomoNumber("1".repeat(16))).toBe(false);
    expect(isValidMomoNumber("call-me-maybe")).toBe(false);
    expect(isValidMomoNumber("")).toBe(false);
  });
});

describe("buildDepositSource", () => {
  it("builds a bank source with no account details for bank and p2p rails", () => {
    expect(buildDepositSource("bank")).toEqual({ accountType: "bank" });
    expect(buildDepositSource("p2p")).toEqual({ accountType: "bank" });
    // stray momo state left in the form must not leak into a bank source
    expect(
      buildDepositSource("bank", { phone: "0801", networkId: "n1" }),
    ).toEqual({ accountType: "bank" });
  });
  it("builds a momo source with normalized payer phone and networkId", () => {
    expect(
      buildDepositSource("momo", {
        phone: "+237 677 (889) 900",
        networkId: "net-1",
      }),
    ).toEqual({
      accountType: "momo",
      accountNumber: "+237677889900",
      networkId: "net-1",
    });
  });
  it("omits networkId when the corridor has no networks to pick", () => {
    const src = buildDepositSource("momo", { phone: "0801234567" });
    expect(src).toEqual({ accountType: "momo", accountNumber: "0801234567" });
    expect("networkId" in src).toBe(false);
  });
});

describe("dedupeNetworksByName", () => {
  it("keeps the first id per case-insensitive operator name (CI lists Wave twice)", () => {
    const nets = [
      { id: "a", name: "Wave", accountNumberType: null },
      { id: "b", name: "Moov", accountNumberType: null },
      { id: "c", name: "wave ", accountNumberType: null },
      { id: "d", name: "Moov money", accountNumberType: null },
    ];
    expect(dedupeNetworksByName(nets).map((n) => n.id)).toEqual([
      "a",
      "b",
      "d",
    ]);
  });
  it("passes through an already-unique list untouched", () => {
    const nets = [
      { id: "a", name: "MTN", accountNumberType: null },
      { id: "b", name: "Moov", accountNumberType: null },
    ];
    expect(dedupeNetworksByName(nets)).toEqual(nets);
  });
});

describe("RampApiError vs network failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("throws RampApiError with the status on a definitive server rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "amount_out_of_range" }), {
            status: 422,
          }),
      ),
    );
    const err = await fetchRampQuote("NGN", "1").catch((e) => e);
    expect(err).toBeInstanceOf(RampApiError);
    expect((err as RampApiError).status).toBe(422);
    expect((err as RampApiError).message).toBe("amount_out_of_range");
  });
  it("lets network failures propagate as plain errors (outcome unknown)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const err = await fetchRampQuote("NGN", "1").catch((e) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(RampApiError);
  });
});

describe("isTerminalDepositState", () => {
  // State names must match the keeper's DepositState union exactly
  // (fiat-bridge-keeper/src/core/deposits.ts) — 'paid', not 'paid_out'.
  it("flags terminal states", () => {
    for (const s of ["paid", "expired", "failed_create", "manual_review"]) {
      expect(isTerminalDepositState(s)).toBe(true);
    }
  });
  it("keeps polling on in-flight states", () => {
    for (const s of [
      "created",
      "awaiting_payment",
      "fiat_confirmed",
      "paying",
    ]) {
      expect(isTerminalDepositState(s)).toBe(false);
    }
  });
});
