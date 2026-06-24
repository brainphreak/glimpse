export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { execFile, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const CLI = process.env.CLAUDE_CLI || "claude";

interface InMessage { role: "user" | "assistant"; content: string }

// Is the `claude` CLI authenticated? Check for its stored credentials file.
function isLoggedIn(): boolean {
  const paths = [
    path.join(os.homedir(), ".claude", ".credentials.json"),
    "/root/.claude/.credentials.json",
  ];
  return paths.some((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

// GET — availability probe. Returns { available, version, loggedIn }.
export async function GET() {
  return new Promise<Response>((resolve) => {
    execFile(CLI, ["--version"], { timeout: 5000 }, (err, stdout) => {
      resolve(NextResponse.json({ available: !err, version: (stdout || "").trim(), loggedIn: isLoggedIn() }));
    });
  });
}

// POST — run `claude -p` (print mode) using the server's subscription auth and
// stream stdout back as NDJSON { t:"text" } / { t:"error" } / { t:"done" }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: InMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const system: string = typeof body.system === "string" ? body.system : "";
  const model: string = typeof body.model === "string" ? body.model.replace(/^claude-cli-?/, "") : "";

  // Flatten the conversation into a single print-mode prompt.
  const convo = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
  const prompt = [system && `System: ${system}`, convo].filter(Boolean).join("\n\n");

  const args = ["-p", prompt];
  if (/^(sonnet|opus|haiku)$/i.test(model)) args.push("--model", model.toLowerCase());

  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream({
    start(controller) {
      // Run in /tmp so the CLI doesn't scan the app directory.
      const child = spawn(CLI, args, { cwd: "/tmp", env: process.env });
      let stderr = "";
      let closed = false;
      const finish = (obj?: unknown) => {
        if (closed) return;
        closed = true;
        if (obj) controller.enqueue(send(obj));
        controller.enqueue(send({ t: "done" }));
        controller.close();
      };
      const timer = setTimeout(() => { child.kill("SIGKILL"); finish({ t: "error", v: "claude CLI timed out" }); }, 180000);

      child.stdout.on("data", (d: Buffer) => { if (!closed) controller.enqueue(send({ t: "text", v: d.toString() })); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("error", (e) => { clearTimeout(timer); finish({ t: "error", v: `claude CLI: ${e.message}` }); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) finish();
        else finish({ t: "error", v: stderr.trim() || `claude CLI exited with code ${code}` });
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
