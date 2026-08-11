"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import Navigation from "@/components/Navigation";
import {
  amountWithinCorridorLimits,
  COUNTRY_KYC_EXTRAS,
  channelTypeLabel,
  countryDisplayName,
  createRampDeposit,
  fetchRampChannels,
  fetchRampDeposit,
  fetchRampQuote,
  isEvmAddress,
  isTerminalDepositState,
  isValidLocalAmount,
  makeIdempotencyKey,
  type RampCorridor,
  type RampCustomer,
  type RampDeposit,
  sourceAccountTypeFor,
} from "@/lib/ramp";

const inputClass =
  "w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]";

/**
 * Buy KUSD with local fiat via Yellow Card.
 *
 * Wiring is real (talks to the fiat-bridge-keeper through /api/ramp/*). Flow:
 *   1. form  — corridor + amount + payout wallet + KYC details
 *   2. pay   — show Yellow Card bank details, poll deposit status
 *   3. done  — terminal state (paid_out / expired / failed)
 */
export default function BuyPage() {
  const { address } = useAccount();

  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Corridors come from the keeper (which mirrors Yellow Card's active
  // deposit channels) — nothing country-specific is hardcoded here.
  const [corridors, setCorridors] = useState<RampCorridor[] | null>(null);
  const [corridorsError, setCorridorsError] = useState("");
  const [corridorId, setCorridorId] = useState("");
  const corridor = corridors?.find((c) => c.channelId === corridorId) ?? null;

  // form state
  const [localAmount, setLocalAmount] = useState("");
  const [userWallet, setUserWallet] = useState("");
  const [payoutUsd, setPayoutUsd] = useState<string | null>(null);
  const [customer, setCustomer] = useState<RampCustomer>({
    name: "",
    country: "",
  });

  // deposit state
  const [deposit, setDeposit] = useState<RampDeposit | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRampChannels()
      .then((list) => {
        if (!cancelled) setCorridors(list);
      })
      .catch((e) => {
        if (!cancelled)
          setCorridorsError(
            e instanceof Error ? e.message : "failed to load countries",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the KYC country in sync with the selected corridor.
  useEffect(() => {
    if (corridor) setCustomer((c) => ({ ...c, country: corridor.country }));
  }, [corridor]);

  // Autofill payout wallet from the connected account (still editable).
  useEffect(() => {
    if (address && !userWallet) setUserWallet(address);
  }, [address, userWallet]);

  const limitsMessage = useCallback((c: RampCorridor): string => {
    const parts: string[] = [];
    if (c.min !== null && c.min > 0)
      parts.push(`min ${c.min.toLocaleString()}`);
    if (c.max !== null && c.max > 0)
      parts.push(`max ${c.max.toLocaleString()}`);
    return parts.length
      ? `Amount out of range (${parts.join(", ")} ${c.currency})`
      : "Amount out of range";
  }, []);

  const getQuote = useCallback(async () => {
    setError("");
    setPayoutUsd(null);
    if (!corridor || !localAmount) return;
    if (!isValidLocalAmount(localAmount)) {
      setError("Enter a valid amount");
      return;
    }
    if (!amountWithinCorridorLimits(localAmount, corridor)) {
      setError(limitsMessage(corridor));
      return;
    }
    try {
      const q = await fetchRampQuote(corridor.currency, localAmount);
      setPayoutUsd(String(q.payoutUsd ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "quote failed");
    }
  }, [corridor, localAmount, limitsMessage]);

  const submit = useCallback(async () => {
    setError("");
    if (!corridor) return setError("Select your country first");
    if (!isValidLocalAmount(localAmount))
      return setError("Enter a valid amount");
    if (!amountWithinCorridorLimits(localAmount, corridor))
      return setError(limitsMessage(corridor));
    if (!isEvmAddress(userWallet))
      return setError("Enter a valid KalyChain wallet address");
    if (!customer.name.trim()) return setError("Enter your full name");
    setSubmitting(true);
    try {
      const d = await createRampDeposit({
        idempotencyKey: makeIdempotencyKey(userWallet),
        userWallet,
        channelId: corridor.channelId,
        currency: corridor.currency,
        localAmount,
        customer,
        source: { accountType: sourceAccountTypeFor(corridor.channelType) },
        reason: "other",
      });
      setDeposit(d);
      setStep("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "deposit failed");
    } finally {
      setSubmitting(false);
    }
  }, [corridor, customer, localAmount, userWallet, limitsMessage]);

  // Poll deposit status while on the pay screen.
  useEffect(() => {
    if (step !== "pay" || !deposit?.depositId) return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await fetchRampDeposit(deposit.depositId);
        setDeposit(d);
        if (isTerminalDepositState(String(d.state))) setStep("done");
      } catch {
        // transient poll errors are fine; next tick retries
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, deposit?.depositId]);

  const setCust = (patch: Partial<RampCustomer>) =>
    setCustomer((c) => ({ ...c, ...patch }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Buy KUSD</h1>
            <p className="text-[#9ca3af] text-lg">
              Pay with a local bank transfer and receive KUSD on KalyChain
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
              {error}
            </div>
          )}

          {step === "form" && (
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              {/* Country */}
              <div className="mb-6">
                <label
                  htmlFor="ramp-country"
                  className="block text-[#9ca3af] text-sm font-medium mb-2"
                >
                  Country
                </label>
                <select
                  id="ramp-country"
                  className={inputClass}
                  value={corridorId}
                  onChange={(e) => setCorridorId(e.target.value)}
                  disabled={!corridors}
                >
                  <option value="" disabled>
                    {corridors ? "Select your country" : "Loading countries…"}
                  </option>
                  {corridors?.map((c) => (
                    <option key={c.channelId} value={c.channelId}>
                      {countryDisplayName(c.country)} — {c.currency} (
                      {channelTypeLabel(c.channelType)})
                    </option>
                  ))}
                </select>
                {corridorsError && (
                  <p className="mt-2 text-xs text-red-400">
                    Could not load countries: {corridorsError}
                  </p>
                )}
                {corridor?.estimatedSettlementTime ? (
                  <p className="mt-2 text-xs text-[#6b7280]">
                    Typical settlement: ~{corridor.estimatedSettlementTime} min
                  </p>
                ) : null}
              </div>

              {/* Amount */}
              <div className="mb-6">
                <label
                  htmlFor="ramp-amount"
                  className="block text-[#9ca3af] text-sm font-medium mb-2"
                >
                  Amount
                </label>
                <div className="relative">
                  <input
                    id="ramp-amount"
                    type="text"
                    inputMode="decimal"
                    value={localAmount}
                    onChange={(e) => setLocalAmount(e.target.value)}
                    onBlur={getQuote}
                    placeholder="25000"
                    className={`${inputClass} pr-16 text-lg`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                    {corridor?.currency ?? ""}
                  </div>
                </div>
                {corridor &&
                ((corridor.min !== null && corridor.min > 0) ||
                  (corridor.max !== null && corridor.max > 0)) ? (
                  <p className="mt-2 text-xs text-[#6b7280]">
                    {corridor.min !== null && corridor.min > 0
                      ? `Min ${corridor.min.toLocaleString()} ${corridor.currency}`
                      : ""}
                    {corridor.min !== null &&
                    corridor.min > 0 &&
                    corridor.max !== null &&
                    corridor.max > 0
                      ? " · "
                      : ""}
                    {corridor.max !== null && corridor.max > 0
                      ? `Max ${corridor.max.toLocaleString()} ${corridor.currency}`
                      : ""}
                  </p>
                ) : null}
              </div>

              {/* Quote */}
              {payoutUsd && (
                <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-sm">
                      You will receive
                    </span>
                    <span className="text-white font-medium">
                      ≈ {payoutUsd} KUSD
                    </span>
                  </div>
                </div>
              )}

              {/* Payout wallet */}
              <div className="mb-6">
                <label
                  htmlFor="ramp-wallet"
                  className="block text-[#9ca3af] text-sm font-medium mb-2"
                >
                  KalyChain wallet (receives the KUSD)
                </label>
                <input
                  id="ramp-wallet"
                  type="text"
                  value={userWallet}
                  onChange={(e) => setUserWallet(e.target.value)}
                  placeholder="0x…"
                  className={`${inputClass} font-mono text-sm`}
                />
              </div>

              {/* KYC */}
              <div className="border-t border-[#262626] pt-6 mb-6">
                <h2 className="text-white font-semibold mb-1">Your details</h2>
                <p className="text-[#6b7280] text-xs mb-4">
                  Required by Yellow Card for regulatory compliance — used only
                  for this payment.
                </p>
                <div className="space-y-3">
                  <input
                    className={inputClass}
                    placeholder="Full name"
                    value={customer.name}
                    onChange={(e) => setCust({ name: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Email"
                    value={customer.email ?? ""}
                    onChange={(e) => setCust({ email: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Phone (+234…)"
                    value={customer.phone ?? ""}
                    onChange={(e) => setCust({ phone: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Address"
                    value={customer.address ?? ""}
                    onChange={(e) => setCust({ address: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Date of birth (mm/dd/yyyy)"
                    value={customer.dob ?? ""}
                    onChange={(e) => setCust({ dob: e.target.value })}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className={inputClass}
                      placeholder="ID type (e.g. license)"
                      value={customer.idType ?? ""}
                      onChange={(e) => setCust({ idType: e.target.value })}
                    />
                    <input
                      className={inputClass}
                      placeholder="ID number"
                      value={customer.idNumber ?? ""}
                      onChange={(e) => setCust({ idNumber: e.target.value })}
                    />
                  </div>
                  {corridor && COUNTRY_KYC_EXTRAS[corridor.country] && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder={
                          COUNTRY_KYC_EXTRAS[corridor.country]?.label
                        }
                        value={customer.additionalIdType ?? ""}
                        onChange={(e) =>
                          setCust({ additionalIdType: e.target.value })
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder={`${COUNTRY_KYC_EXTRAS[corridor.country]?.label} number`}
                        value={customer.additionalIdNumber ?? ""}
                        onChange={(e) =>
                          setCust({ additionalIdNumber: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="w-full bg-[#F59E0B] hover:bg-[#FBBF24] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || !corridor}
                onClick={submit}
              >
                {submitting ? "Creating deposit…" : "Continue to payment"}
              </button>
            </div>
          )}

          {step === "pay" && deposit && (
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-white text-xl font-semibold mb-2">
                Make your bank transfer
              </h2>
              <p className="text-[#9ca3af] text-sm mb-6">
                Pay exactly{" "}
                <span className="text-white font-medium">
                  {localAmount} {corridor?.currency ?? ""}
                </span>{" "}
                to the account below.
                {deposit.expiresAt && (
                  <>
                    {" "}
                    Offer expires{" "}
                    {new Date(deposit.expiresAt).toLocaleTimeString()}.
                  </>
                )}
              </p>
              <pre className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6 overflow-x-auto text-xs text-[#9ca3af] font-mono">
                {JSON.stringify(deposit.bankInfo ?? {}, null, 2)}
              </pre>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-[#F59E0B] animate-pulse" />
                <span className="text-[#6b7280]">Status:</span>
                <span className="text-white font-mono">
                  {String(deposit.state)}
                </span>
                <span className="text-[#6b7280]">(updates automatically)</span>
              </div>
              <p className="mt-4 text-xs text-[#6b7280]">
                KUSD usually arrives within a couple of minutes after your
                payment is confirmed. In times of high demand it can take up to
                10 minutes — no action needed, this page updates on its own.
              </p>
            </div>
          )}

          {step === "done" && deposit && (
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-white text-xl font-semibold mb-2">
                {deposit.state === "paid"
                  ? "KUSD sent 🎉"
                  : deposit.state === "manual_review"
                    ? "Deposit needs manual review — contact support"
                    : "Deposit did not complete"}
              </h2>
              <p className="text-[#9ca3af] text-sm mb-4">
                Final status:{" "}
                <span className="text-white font-mono">
                  {String(deposit.state)}
                </span>
              </p>
              {typeof deposit.payoutTxHash === "string" && (
                <a
                  className="text-sm text-[#F59E0B] hover:text-[#FBBF24] underline"
                  href={`https://kalyscan.io/tx/${deposit.payoutTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on KalyScan
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
