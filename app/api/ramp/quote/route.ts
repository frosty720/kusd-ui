import { type NextRequest, NextResponse } from 'next/server'
import { keeperFetch } from '@/lib/ramp-server'

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get('currency') ?? ''
  const localAmount = req.nextUrl.searchParams.get('localAmount') ?? ''
  if (!currency || !localAmount) {
    return NextResponse.json({ error: 'currency and localAmount required' }, { status: 400 })
  }
  const params = new URLSearchParams({ currency, localAmount })
  // Corridor context for YC's fee config (required: country + channelType);
  // absent on older cached bundles, so it stays optional here.
  const country = req.nextUrl.searchParams.get('country')
  const channelType = req.nextUrl.searchParams.get('channelType')
  if (country) params.set('country', country)
  if (channelType) params.set('channelType', channelType)
  const r = await keeperFetch(`/api/quote?${params}`)
  return NextResponse.json(r.body, { status: r.status })
}
