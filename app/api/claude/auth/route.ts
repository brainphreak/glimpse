export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import * as pty from "node-pty";
import { getConfig, setConfig } from "@/lib/config";
import { CLI, cliEnv } from "@/lib/claude-cli";

// Re-login for the Claude CLI from the dashboard. Drives `claude setup-token` in a PTY:
//   start  → returns the claude.ai authorize URL to open in the browser
//   finish → pastes the code shown after approving, captures the ~1-year token, saves it
// The token is stored as claude_oauth_token and passed to the CLI as CLAUDE_CODE_OAUTH_TOKEN.

const TOKEN_LIFETIME_DAYS = 365;

interface Flow { proc: pty.IPty; raw: string; exited: boolean }
// Survives module reloads in dev; one login flow at a time.
const g = globalThis as unknown as { __claudeAuthFlow?: Flow | null };

// Strip OSC (e.g. hyperlinks) and CSI escape sequences.
const strip = (s: string) => s.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\x1b[()][A-Z0-9]/g, "");

function findUrl(raw: string): string | null {
  // Look in the raw output too: Ink may put the full URL only inside an OSC-8 hyperlink.
  const all = [...raw.matchAll(/https:\/\/[^\s\x07\x1b"'<>]+/g), ...strip(raw).matchAll(/https:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
  return all.find((u) => /oauth|authorize/i.test(u)) || null;
}

// Match on the stripped text as-is: removing whitespace would glue the following words onto the token.
const TOKEN_RE = /sk-ant-oat\d+-[A-Za-z0-9_-]{20,}/;
const findToken = (raw: string) => strip(raw).match(TOKEN_RE)?.[0] || null;

// Run a tiny real request through the same path the widgets use.
function testCli(): Promise<{ ok: boolean; reply?: string; error?: string }> {
  return new Promise((resolve) => {
    // stdin ignored: with an open pipe `claude -p` waits for piped input.
    const child = spawn(CLI, ["-p", "Reply with just: OK", "--model", "haiku"], { cwd: "/tmp", env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ ok: false, error: "Timed out" }); }, 60_000);
    child.stdout.on("data", (d: Buffer) => { out += d; });
    child.stderr.on("data", (d: Buffer) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { ok: true, reply: out.trim().slice(0, 100) } : { ok: false, error: (err || out).trim().slice(0, 500) || `exit ${code}` });
    });
  });
}

function saveToken(token: string) {
  setConfig("claude_oauth_token", token);
  setConfig("claude_oauth_token_saved", new Date().toISOString());
}

function killFlow() {
  const f = g.__claudeAuthFlow;
  if (f && !f.exited) { try { f.proc.kill(); } catch {} }
  g.__claudeAuthFlow = null;
}

async function waitFor<T>(fn: () => T | null, ms: number): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    if (g.__claudeAuthFlow?.exited) return fn();
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const tail = (raw: string) => strip(raw).trim().split("\n").slice(-6).join("\n").slice(-600);

// Expiry of the auto-refreshing login in the credentials file, if any.
function credsExpiry(): number | null {
  try {
    const j = JSON.parse(fs.readFileSync("/root/.claude/.credentials.json", "utf8"));
    return typeof j?.claudeAiOauth?.expiresAt === "number" ? j.claudeAiOauth.expiresAt : null;
  } catch { return null; }
}

// GET — status for the Settings panel.
export async function GET() {
  const savedAt = getConfig("claude_oauth_token_saved");
  const tokenSet = !!getConfig("claude_oauth_token");
  const expiresAt = tokenSet && savedAt ? new Date(new Date(savedAt).getTime() + TOKEN_LIFETIME_DAYS * 86400000).toISOString() : null;
  return NextResponse.json({ tokenSet, savedAt: savedAt || null, expiresAt, credsExpiresAt: credsExpiry(), flowActive: !!g.__claudeAuthFlow });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "start") {
    killFlow();
    let proc: pty.IPty;
    try {
      // Wide terminal so the URL isn't wrapped; BROWSER=true stops it trying to open one server-side.
      proc = pty.spawn(CLI, ["setup-token"], {
        name: "xterm-256color", cols: 2000, rows: 50, cwd: "/tmp",
        env: { ...process.env, BROWSER: "true", CLAUDE_CODE_OAUTH_TOKEN: "" } as Record<string, string>,
      });
    } catch (e) {
      return NextResponse.json({ error: `Couldn't start claude: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
    const flow: Flow = { proc, raw: "", exited: false };
    proc.onData((d) => { flow.raw += d; if (flow.raw.length > 200_000) flow.raw = flow.raw.slice(-100_000); });
    proc.onExit(() => { flow.exited = true; });
    g.__claudeAuthFlow = flow;
    // Abandoned flows are cleaned up after 10 minutes.
    setTimeout(() => { if (g.__claudeAuthFlow === flow) killFlow(); }, 600_000);

    const url = await waitFor(() => findUrl(flow.raw), 25_000);
    if (!url) {
      const out = tail(flow.raw);
      killFlow();
      return NextResponse.json({ error: `Didn't get a login URL from claude setup-token.${out ? `\n${out}` : ""}` }, { status: 500 });
    }
    return NextResponse.json({ url });
  }

  if (action === "finish") {
    const flow = g.__claudeAuthFlow;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!flow || flow.exited) return NextResponse.json({ error: "Login session expired — click Start again." }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Paste the code from the claude.ai page." }, { status: 400 });

    const before = flow.raw.length;
    flow.proc.write(code);
    await new Promise((r) => setTimeout(r, 400));   // let Ink treat the paste and Enter separately
    flow.proc.write("\r");

    const token = await waitFor(() => findToken(flow.raw.slice(before)), 45_000);
    if (!token) {
      const out = tail(flow.raw.slice(before));
      killFlow();
      return NextResponse.json({ error: `No token came back — the code may be wrong or expired. Start again.${out ? `\n${out}` : ""}` }, { status: 400 });
    }
    saveToken(token);
    killFlow();
    const t = await testCli();
    return NextResponse.json(t.ok ? { ok: true } : { error: `Token saved but the test failed: ${t.error}` });
  }

  if (action === "save") {
    // Manual fallback: a token from running `claude setup-token` anywhere.
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!new RegExp(`^${TOKEN_RE.source}$`).test(token)) return NextResponse.json({ error: "That doesn't look like a setup-token (sk-ant-oat01-…)." }, { status: 400 });
    saveToken(token);
    const t = await testCli();
    return NextResponse.json(t.ok ? { ok: true } : { error: `Token saved but the test failed: ${t.error}` });
  }

  if (action === "cancel") {
    killFlow();
    return NextResponse.json({ ok: true });
  }

  if (action === "clear") {
    setConfig("claude_oauth_token", "");
    setConfig("claude_oauth_token_saved", "");
    return NextResponse.json({ ok: true });
  }

  if (action === "test") return NextResponse.json(await testCli());

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
