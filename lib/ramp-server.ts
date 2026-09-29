/**
 * Server-only helper for the /api/ramp/* routes: forwards requests to the
 * fiat-bridge-keeper with the keeper API key attached. The key lives ONLY in
 * server env (no NEXT_PUBLIC_ prefix) and must never reach the browser.
 *
 * Env:
 *   RAMP_KEEPER_URL      keeper base URL (default http://localhost:8080 —
 *                        kusd-ui and the keeper run on the same box)
 *   RAMP_KEEPER_API_KEY  keeper bearer token (required for ramp routes to work)
 */

const KEEPER_URL = process.env.RAMP_KEEPER_URL || "http://localhost:8080";
const KEEPER_API_KEY = process.env.RAMP_KEEPER_API_KEY || "";

/** Error key for a keeper call whose outcome is unknown (lib/ramp.ts reads the same value). */
export const KEEPER_UNREACHABLE = "keeper_unreachable";

export interface KeeperResult {
  status: number;
  body: unknown;
}

export async function keeperFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<KeeperResult> {
  if (!KEEPER_API_KEY) {
    return { status: 503, body: { error: "ramp not configured" } };
  }
  let res: Response;
  try {
    res = await fetch(KEEPER_URL + path, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${KEEPER_API_KEY}`,
        ...(init?.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      // Keeper calls are same-host; fail fast rather than hanging the route.
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    // Unreachable or timed out: a POST may still have created the deposit, so the outcome is
    // UNKNOWN — the browser must keep its idempotency key and retry with it (see RampApiError).
    return { status: 504, body: { error: KEEPER_UNREACHABLE } };
  }
  const body = await res.json().catch(() => ({ error: "bad keeper response" }));
  return { status: res.status, body };
}
