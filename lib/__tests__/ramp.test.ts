import { afterEach, describe, expect, it, vi } from "vitest";
import {
  amountWithinCorridorLimits,
  buildDepositSource,
  channelTypeLabel,
  countryDisplayName,
  dedupeNetworksByName,
  fetchRampChannels,
  fetchRampQuote,
  isEvmAddress,
  isInternationalPhone,
  isTerminalDepositState,
  isValidLocalAmount,
  makeIdempotencyKey,
  normalizePhoneForCountry,
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

describe("isInternationalPhone", () => {
  it("accepts + international numbers with common separators", () => {
    expect(isInternationalPhone("+2348012345678")).toBe(true);
    expect(isInternationalPhone("+225 05 56 41 80 73")).toBe(true);
    expect(isInternationalPhone("+237 677-889-900")).toBe(true);
  });
  it("REJECTS local formats — YC hard-rejects them (prod 2026-08-11)", () => {
    expect(isInternationalPhone("0556418073")).toBe(false);
    expect(isInternationalPhone("0801 234 5678")).toBe(false);
  });
  it("rejects too-short, too-long, and non-numeric input", () => {
    expect(isInternationalPhone("+12345")).toBe(false);
    expect(isInternationalPhone(`+${"1".repeat(16)}`)).toBe(false);
    expect(isInternationalPhone("call-me-maybe")).toBe(false);
    expect(isInternationalPhone("")).toBe(false);
  });
});

describe("normalizePhoneForCountry", () => {
  // Prod report 2026-08-13: a Burkina Faso user's valid 8-digit local number
  // was rejected because the form demanded hand-typed international format.
  it("prepends the dial code to a bare local number (BF, 8 digits)", () => {
    expect(normalizePhoneForCountry("70216205", "BF")).toBe("+22670216205");
  });
  it("normalized local input passes isInternationalPhone (the BF regression)", () => {
    expect(
      isInternationalPhone(normalizePhoneForCountry("70216205", "BF")),
    ).toBe(true);
  });
  it("passes already-international numbers through, stripping separators", () => {
    expect(normalizePhoneForCountry("+22670216205", "BF")).toBe("+22670216205");
    expect(normalizePhoneForCountry("+226 70 21 62 05", "BF")).toBe(
      "+22670216205",
    );
  });
  it("strips separators from local input before prepending", () => {
    expect(normalizePhoneForCountry("70 21 62 05", "BF")).toBe("+22670216205");
  });
  it("converts the 00 international-dialing prefix to +", () => {
    expect(normalizePhoneForCountry("0022670216205", "BF")).toBe(
      "+22670216205",
    );
  });
  it("adds only + when the country code was typed without it", () => {
    expect(normalizePhoneForCountry("22670216205", "BF")).toBe("+22670216205");
  });
  it("does NOT mistake a local number starting with the dial digits for a country-coded one", () => {
    // 22 67 02 16 is a plausible 8-digit BF landline — its first three
    // digits happen to equal the dial code, but it's far too short to
    // already contain one.
    expect(normalizePhoneForCountry("22670216", "BF")).toBe("+22622670216");
  });
  it("drops the trunk 0 for countries that omit it internationally (NG)", () => {
    expect(normalizePhoneForCountry("08012345678", "NG")).toBe(
      "+2348012345678",
    );
  });
  it("keeps the leading 0 for CI — it became part of the number in 2021", () => {
    expect(normalizePhoneForCountry("0701234567", "CI")).toBe("+2250701234567");
  });
  it("returns input unchanged (minus separators) for unknown countries", () => {
    // XQ is unassigned in ISO 3166 — no dial code entry. The validator
    // stays the hard gate; normalization must not guess.
    expect(normalizePhoneForCountry("70 21 62 05", "XQ")).toBe("70216205");
  });
  it("leaves non-numeric and empty input for the validator to reject", () => {
    expect(normalizePhoneForCountry("abc123", "BF")).toBe("abc123");
    expect(normalizePhoneForCountry("", "BF")).toBe("");
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

describe("fetchRampChannels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("passes through the keeper's USD policy bounds alongside corridors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              corridors: [],
              minDepositUsd: "5",
              maxDepositUsd: "20000",
            }),
            { status: 200 },
          ),
      ),
    );
    const res = await fetchRampChannels();
    expect(res.corridors).toEqual([]);
    expect(res.minDepositUsd).toBe("5");
    expect(res.maxDepositUsd).toBe("20000");
  });
  it("defaults corridors to an empty array when absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    const res = await fetchRampChannels();
    expect(res.corridors).toEqual([]);
  });
});

describe("fetchRampQuote", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("sends the corridor context YC's fee config requires (country, channelType)", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify({ payoutUsd: "9.8" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchRampQuote("XOF", "6000", {
      country: "CI",
      channelType: "momo",
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("currency=XOF");
    expect(url).toContain("localAmount=6000");
    expect(url).toContain("country=CI");
    expect(url).toContain("channelType=momo");
  });
});

describe("RampApiError vs network failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("throws RampApiError with a human message for known keeper error keys", async () => {
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
    expect((err as RampApiError).message).toBe(
      "This amount is outside the allowed range for your country.",
    );
  });
  it("prefers Yellow Card's specific code over the keeper's generic 'provider'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "provider",
              code: "InvalidPhoneNumberFormat",
            }),
            { status: 502 },
          ),
      ),
    );
    const err = await fetchRampQuote("NGN", "1").catch((e) => e);
    expect((err as RampApiError).message).toBe(
      "Phone number must be in international format (e.g. +2250701234567).",
    );
  });
  it("wraps unmapped errors in the provider message instead of showing them raw", async () => {
    // Fastify's default 400 body ({error: "Bad Request"}) reached users
    // verbatim on 2026-08-12 — unmapped keys must read as a human sentence,
    // keeping the raw code only as a diagnostic suffix.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Bad Request" }), {
            status: 400,
          }),
      ),
    );
    const err = await fetchRampQuote("NGN", "1").catch((e) => e);
    expect((err as RampApiError).message).toBe(
      "The payment provider could not process this request. Please try again shortly. (Bad Request)",
    );
  });
  it("prefers the specific code over the generic error key in the fallback suffix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "Bad Request",
              code: "InvalidRequestBody",
            }),
            { status: 400 },
          ),
      ),
    );
    const err = await fetchRampQuote("NGN", "1").catch((e) => e);
    expect((err as RampApiError).message).toBe(
      "The payment provider could not process this request. Please try again shortly. (InvalidRequestBody)",
    );
  });
  it("marks a keeper our route could not reach as an UNKNOWN outcome (keep the idempotency key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "keeper_unreachable" }), {
            status: 504,
          }),
      ),
    );
    const err = (await fetchRampQuote("NGN", "1").catch((e) => e)) as RampApiError;
    expect(err).toBeInstanceOf(RampApiError);
    expect(err.outcomeUnknown).toBe(true);
    expect(err.message).toBe(
      "Could not reach the payment service. Please try again — retrying will not create a second payment.",
    );
  });
  it("treats a keeper rejection as definitive (a fresh key next time)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "amount_out_of_range" }), {
            status: 422,
          }),
      ),
    );
    const err = (await fetchRampQuote("NGN", "1").catch((e) => e)) as RampApiError;
    expect(err.outcomeUnknown).toBe(false);
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
