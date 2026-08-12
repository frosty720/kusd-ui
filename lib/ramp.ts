/**
 * Fiat ramp (Yellow Card) — shared types + pure helpers + browser client.
 *
 * The browser NEVER talks to the keeper or Yellow Card directly: all calls go
 * through the Next.js API routes under /api/ramp/* which attach the keeper
 * API key server-side (see lib/ramp-server.ts).
 */

// ── Types (mirror fiat-bridge-keeper's public API) ──────────────────────────

export interface RampQuote {
  grossUsd: string;
  feesUsd: string;
  netUsd: string;
  kusd: string;
  /** Net USD the user would receive — the buy page's estimate + $-floor check. */
  payoutUsd: string;
  [k: string]: unknown;
}

// Mirrors DepositState in fiat-bridge-keeper/src/core/deposits.ts — the
// keeper's code is the authority, not its spec docs (states are 'paying'/
// 'paid', not 'paying_out'/'paid_out'; caught in the full-stack rehearsal).
export type RampDepositState =
  | "created"
  | "awaiting_payment"
  | "fiat_confirmed"
  | "paying"
  | "paid"
  | "expired"
  | "failed_create"
  | "manual_review";

export interface RampDeposit {
  depositId: string;
  state: RampDepositState | string;
  payoutUsd?: string;
  /** The original ask — lets the pay screen render after a ?deposit= resume. */
  fiatAmount?: string;
  fiatCurrency?: string;
  /** Bank account details the user must pay into (from Yellow Card). */
  bankInfo?: Record<string, unknown>;
  expiresAt?: string;
  /** Hosted payment page for redirect channels (e.g. Wave) — user must open it. */
  paymentUrl?: string | null;
  payoutTxHash?: string;
  [k: string]: unknown;
}

export interface RampCustomer {
  name: string;
  country: string;
  phone?: string;
  address?: string;
  dob?: string;
  email?: string;
  idNumber?: string;
  idType?: string;
  additionalIdType?: string;
  additionalIdNumber?: string;
}

export interface CreateRampDepositInput {
  idempotencyKey: string;
  userWallet: string;
  channelId: string;
  currency: string;
  localAmount: string;
  customer: RampCustomer;
  source: {
    accountType: "bank" | "momo";
    accountNumber?: string;
    networkId?: string;
  };
  reason?: string;
}

// ── Corridors (fetched live from the keeper via /api/ramp/channels) ─────────

export interface RampCorridorNetwork {
  id: string;
  name: string;
  accountNumberType: string | null;
}

export interface RampCorridor {
  channelId: string;
  country: string;
  currency: string;
  channelType: "bank" | "momo" | "p2p";
  min: number | null;
  max: number | null;
  estimatedSettlementTime: number | null;
  networks: RampCorridorNetwork[];
}

/**
 * Per-country KYC extras the provider requires beyond the base fields.
 * Regulatory knowledge, not channel data — the only corridor info kept in code.
 */
export const COUNTRY_KYC_EXTRAS: Record<
  string,
  { label: string; hint: string } | undefined
> = {
  NG: { label: "BVN or NIN", hint: "Required by Nigerian regulation" },
};

/** Map a corridor's payment rail to the source accountType the keeper accepts. */
export function sourceAccountTypeFor(
  channelType: RampCorridor["channelType"],
): "bank" | "momo" {
  return channelType === "momo" ? "momo" : "bank";
}

/**
 * Build the deposit `source` for a corridor. Yellow Card requires the payer's
 * mobile-money phone number (`accountNumber`) and the momo `networkId` for
 * momo receives; bank/p2p receives need neither in production.
 */
export function buildDepositSource(
  channelType: RampCorridor["channelType"],
  momo: { phone?: string; networkId?: string } = {},
): CreateRampDepositInput["source"] {
  if (channelType === "momo") {
    return {
      accountType: sourceAccountTypeFor(channelType),
      accountNumber: (momo.phone ?? "").replace(/[\s()-]/g, ""),
      ...(momo.networkId ? { networkId: momo.networkId } : {}),
    };
  }
  return { accountType: sourceAccountTypeFor(channelType) };
}

/**
 * Phone check for anything sent to Yellow Card: international format is
 * MANDATORY — a leading + and 6-15 digits. Local formats like 0556418073 get
 * a hard InvalidPhoneNumberFormat rejection from YC (seen in prod 2026-08-11).
 */
export function isInternationalPhone(value: string): boolean {
  return /^\+\d{6,15}$/.test(value.replace(/[\s()-]/g, ""));
}

/**
 * Operator list for display: Yellow Card sometimes returns the same operator
 * name twice under different network ids (e.g. CI lists "Wave" twice) — keep
 * the first id per case-insensitive name so the dropdown reads cleanly.
 */
export function dedupeNetworksByName(
  networks: RampCorridorNetwork[],
): RampCorridorNetwork[] {
  const seen = new Set<string>();
  return networks.filter((n) => {
    const key = n.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Human label for a corridor's payment rail (p2p is a bank transfer to the user). */
export function channelTypeLabel(
  channelType: RampCorridor["channelType"],
): string {
  return channelType === "momo" ? "mobile money" : "bank transfer";
}

/** Country display name from its ISO code — no hardcoded country list. */
export function countryDisplayName(code: string): string {
  try {
    // fallback: "none" makes unknown-but-well-formed codes return undefined
    // instead of ICU's "Unknown Region", so users see the raw code instead.
    return (
      new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(
        code,
      ) ?? code
    );
  } catch {
    return code;
  }
}

/**
 * Validate an amount against a corridor's local-currency bounds.
 * Yellow Card uses 0 for "no limit"; null means the bound was absent.
 */
export function amountWithinCorridorLimits(
  amount: string,
  corridor: Pick<RampCorridor, "min" | "max">,
): boolean {
  const n = Number(amount);
  if (!Number.isFinite(n)) return false;
  if (corridor.min !== null && corridor.min > 0 && n < corridor.min)
    return false;
  if (corridor.max !== null && corridor.max > 0 && n > corridor.max)
    return false;
  return true;
}

// ── Pure helpers (unit-tested in lib/__tests__/ramp.test.ts) ────────────────

/** Loose EVM address check for the payout destination field. */
export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** Positive decimal amount string ("25000", "25000.50"). */
export function isValidLocalAmount(value: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return false;
  return Number(value) > 0 && Number.isFinite(Number(value));
}

/**
 * Client-side idempotency key: stable per (wallet, browser-session attempt).
 * The keeper dedupes on this — a double-click or refresh-resubmit returns the
 * same deposit instead of opening a second Yellow Card receive.
 */
export function makeIdempotencyKey(wallet: string): string {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `ui-${wallet.slice(2, 10).toLowerCase()}-${Date.now()}-${rand[0].toString(36)}${rand[1].toString(36)}`;
}

/** True when a deposit state means the flow is over (stop polling).
 * manual_review is terminal for the UI: it never resolves without a human. */
export function isTerminalDepositState(state: string): boolean {
  return ["paid", "expired", "failed_create", "manual_review"].includes(state);
}

// ── Browser client for /api/ramp/* ──────────────────────────────────────────

/**
 * A definitive answer from the server that is an error (4xx/5xx with a body).
 * Distinguished from network failures (fetch rejects with a plain TypeError)
 * so callers can tell "the server rejected this" from "the outcome is
 * unknown" — the idempotency-key retry logic on /buy depends on that split.
 */
export class RampApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "RampApiError";
  }
}

/**
 * Human messages for the keeper's machine error strings. The keeper's 502
 * additionally carries Yellow Card's own `code` (e.g. InvalidPhoneNumberFormat)
 * so provider rejections can be explained instead of showing a bare "provider".
 */
export const RAMP_ERROR_MESSAGES: Record<string, string> = {
  InvalidPhoneNumberFormat:
    "Phone number must be in international format (e.g. +2250701234567).",
  PaymentValidationError:
    "The payment provider rejected these details — please double-check them and try again.",
  provider:
    "The payment provider could not process this request. Please try again shortly.",
  amount_out_of_range:
    "This amount is outside the allowed range for your country.",
  fees_exceed_amount: "This amount is too small — fees would exceed it.",
  paused: "Deposits are temporarily paused. Please try again later.",
  validation: "Some details are missing or invalid.",
  not_found: "Deposit not found.",
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    // Prefer the provider's specific code over the keeper's generic error key.
    // Unmapped keys (e.g. fastify's default "Bad Request" body, seen in prod
    // 2026-08-12) read as the provider sentence with the raw code kept only
    // as a diagnostic suffix — never shown bare to the user.
    const raw = body.code || body.error;
    const msg =
      (body.code && RAMP_ERROR_MESSAGES[body.code]) ||
      (body.error && RAMP_ERROR_MESSAGES[body.error]) ||
      (raw
        ? `${RAMP_ERROR_MESSAGES.provider} (${raw})`
        : `request failed (${res.status})`);
    throw new RampApiError(res.status, msg);
  }
  return body as T;
}

export interface RampChannelsResponse {
  corridors: RampCorridor[];
  /** The KEEPER's own USD floor/ceiling — the binding limits, often stricter
   * than YC's per-channel local minimums (CI Wave: 1000 XOF ≈ $1.7 vs $5). */
  minDepositUsd?: string;
  maxDepositUsd?: string;
  cachedAt?: string;
  stale?: boolean;
}

export async function fetchRampChannels(): Promise<RampChannelsResponse> {
  const body = await jsonOrThrow<RampChannelsResponse>(
    await fetch("/api/ramp/channels"),
  );
  return { ...body, corridors: body.corridors ?? [] };
}

export async function fetchRampQuote(
  currency: string,
  localAmount: string,
  // Corridor context for YC's fee config — it requires country + channelType,
  // so quotes without them fall back to a zero-fee, rates-only estimate.
  corridor?: { country?: string; channelType?: string },
): Promise<RampQuote> {
  const params = new URLSearchParams({ currency, localAmount });
  if (corridor?.country) params.set("country", corridor.country);
  if (corridor?.channelType) params.set("channelType", corridor.channelType);
  return jsonOrThrow(await fetch(`/api/ramp/quote?${params}`));
}

export async function createRampDeposit(
  input: CreateRampDepositInput,
): Promise<RampDeposit> {
  return jsonOrThrow(
    await fetch("/api/ramp/deposits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchRampDeposit(
  depositId: string,
): Promise<RampDeposit> {
  return jsonOrThrow(
    await fetch(`/api/ramp/deposits/${encodeURIComponent(depositId)}`),
  );
}
