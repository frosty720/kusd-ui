import { type NextRequest, NextResponse } from 'next/server'
import { isEvmAddress, isValidUsdAmount } from '@/lib/ramp'
import { keeperFetch } from '@/lib/ramp-server'

/**
 * Create a mobile-money cash-out. Thin validation here (fast 400s for obviously bad input); the
 * keeper re-validates everything authoritatively with zod.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (typeof body.userWallet !== 'string' || !isEvmAddress(body.userWallet)) {
    return NextResponse.json({ error: 'invalid userWallet' }, { status: 400 })
  }
  if (typeof body.usdAmount !== 'string' || !isValidUsdAmount(body.usdAmount)) {
    return NextResponse.json({ error: 'invalid usdAmount' }, { status: 400 })
  }
  const r = await keeperFetch('/api/withdrawals', { method: 'POST', body })
  return NextResponse.json(r.body, { status: r.status })
}
