import { NextResponse } from "next/server";
import { keeperFetch } from "@/lib/ramp-server";

export async function GET() {
  const r = await keeperFetch("/api/channels");
  return NextResponse.json(r.body, { status: r.status });
}
