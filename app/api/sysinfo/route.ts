export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const total = os.totalmem();
  const free = os.freemem();
  return NextResponse.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    cpus: os.cpus().length,
    memTotal: total,
    memFree: free,
    memUsed: total - free,
    now: Date.now(),
  });
}
