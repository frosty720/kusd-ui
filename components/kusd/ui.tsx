import type { ReactNode } from 'react'

/** The form styles the Buy page already uses (app/buy/page.tsx), shared by the swap and cash-out panels. */
export const inputClass =
  'w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]'

export const primaryButtonClass =
  'w-full flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#FBBF24] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export const outlineButtonClass = 'w-full border border-[#262626] hover:border-[#F59E0B]/60 text-white font-semibold py-3 px-4 rounded-lg transition-colors'

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[#9ca3af] text-sm font-medium mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#6b7280]">{label}</dt>
      <dd className="text-white font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
}

/** The "↓" between the pay and receive boxes. */
export function ArrowDivider() {
  return (
    <div className="-my-3 flex justify-center">
      <span aria-hidden className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#262626] bg-[#1a1a1a] text-[#F59E0B]">
        ↓
      </span>
    </div>
  )
}
