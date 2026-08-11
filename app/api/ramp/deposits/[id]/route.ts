import { type NextRequest, NextResponse } from "next/server";
import { keeperFetch } from "@/lib/ramp-server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const r = await keeperFetch(`/api/deposits/${encodeURIComponent(id)}`);
  return NextResponse.json(r.body, { status: r.status });
}
