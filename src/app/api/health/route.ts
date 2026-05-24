import { NextResponse } from "next/server";

// Portfolio Standard R13 health check. Cheap liveness probe — no DB/auth calls,
// so it stays green even if downstream services are degraded.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "lingopure",
    timestamp: new Date().toISOString(),
  });
}
