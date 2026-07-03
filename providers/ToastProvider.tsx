'use client'

/**
 * Minimal toast system (no external dependency).
 *
 * Renders a bottom-right stack of auto-dismissing toasts. `useToast().showToast`
 * pushes one; transaction toasts can carry an explorer link (see `useTxToast`).
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  type?: ToastType
  message: string
  /** Optional explorer link shown as "View on explorer". */
  href?: string
  /** Auto-dismiss delay in ms (default 7000). */
  durationMs?: number
}

interface Toast extends Required<Pick<ToastOptions, 'type' | 'message'>> {
  id: number
  href?: string
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const STYLES: Record<ToastType, { border: string; icon: string }> = {
  success: { border: 'border-green-500/40', icon: '✅' },
  error: { border: 'border-red-500/40', icon: '⚠️' },
  info: { border: 'border-[#F59E0B]/40', icon: 'ℹ️' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ type = 'info', message, href, durationMs = 7000 }: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, message, href }])
      // Date.now-free timer id source is fine here (client component, not a workflow).
      setTimeout(() => dismiss(id), durationMs)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const style = STYLES[t.type]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-[#1a1a1a] border ${style.border} rounded-lg shadow-lg p-4 flex items-start gap-3 animate-[fadeIn_0.15s_ease-out]`}
            >
              <span className="text-lg leading-none mt-0.5">{style.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm break-words">{t.message}</p>
                {t.href && (
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F59E0B] hover:text-[#FBBF24] text-xs font-medium mt-1 inline-block"
                  >
                    View on explorer ↗
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-[#6b7280] hover:text-white text-sm leading-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
