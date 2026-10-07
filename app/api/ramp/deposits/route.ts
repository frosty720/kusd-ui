import { type NextRequest, NextResponse } from 'next/server'
import { isEvmAddress, isValidLocalAmount } from '@/lib/ramp'
import { keeperFetch } from '@/lib/ramp-server'

/**
 * Create a fiat deposit. Thin validation here (fast 400s for obviously bad
 * input); the keeper re-validates everything authoritatively with zod.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  // `null` and other non-object payloads parse as valid JSON — reject them
  // here instead of throwing on the property reads below.
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (typeof body.userWallet !== 'string' || !isEvmAddress(body.userWallet)) {
    return NextResponse.json({ error: 'invalid userWallet' }, { status: 400 })
  }
  if (typeof body.localAmount !== 'string' || !isValidLocalAmount(body.localAmount)) {
    return NextResponse.json({ error: 'invalid localAmount' }, { status: 400 })
  }

  const r = await keeperFetch('/api/deposits', { method: 'POST', body })
  return NextResponse.json(r.body, { status: r.status })
}
