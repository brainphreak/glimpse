// Custom Next.js server with WebSocket PTY support for the terminal widget
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const fs = require("fs");
const os = require("os");
const next = require("next");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");

// Read the configurable terminal identity (user / host / home) from the
// SQLite config table — the same values you set in Settings → Setup.
function getTerminalConfig() {
  const fromEnv = {
    user: process.env.TERMINAL_USER || "",
    host: process.env.TERMINAL_HOST || "",
    home: process.env.TERMINAL_HOME || "",
  };
  let map = { ...fromEnv };
  try {
    const Database = require("better-sqlite3");
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "dashboard.db");
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare("SELECT key, value FROM config WHERE key IN ('terminal_user','terminal_host','terminal_home')")
      .all();
    db.close();
    for (const r of rows) {
      if (!r.value) continue;
      if (r.key === "terminal_user") map.user = r.value;
      if (r.key === "terminal_host") map.host = r.value;
      if (r.key === "terminal_home") map.home = r.value;
    }
  } catch {}

  const configured = !!(map.user || map.host || map.home);
  const user = map.user || "root";
  const host = map.host || os.hostname();
  const home = map.home || (user === "root" ? "/root" : `/home/${user}`);
  return { configured, user, host, home };
}

// Strip characters that would break the single-quoted PS1 string we write.
function shellSafe(s) {
  return String(s || "").replace(/['"\\$`\n\r]/g, "").slice(0, 64);
}

// Build bash spawn args with a custom rcfile so the prompt becomes
// user@host:/full/path$ and the shell starts in the configured home dir.
function bashArgsFor(tc) {
  if (!tc.configured) return [];
  const user = shellSafe(tc.user);
  const host = shellSafe(tc.host);
  const home = shellSafe(tc.home);
  const rc = [
    `export HOME='${home}'`,
    `mkdir -p "$HOME" 2>/dev/null`,
    `cd "$HOME" 2>/dev/null`,
    `[ -f /etc/bash.bashrc ] && . /etc/bash.bashrc`,
    `[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"`,
    `export PS1='\\[\\e[1;32m\\]${user}@${host}\\[\\e[0m\\]:\\[\\e[1;34m\\]$(pwd)\\[\\e[0m\\]\\$ '`,
    ``,
  ].join("\n");
  const rcPath = path.join(os.tmpdir(), "dashboard_bashrc");
  try {
    fs.writeFileSync(rcPath, rc, { mode: 0o600 });
    return ["--rcfile", rcPath, "-i"];
  } catch {
    return [];
  }
}

// Pick a sane default shell per OS so the terminal works on Linux, macOS and Windows.
function defaultShell() {
  if (process.platform === "win32") return process.env.COMSPEC || "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Persistent sessions: name → { shell, buffer, ws }
// Sessions survive WebSocket disconnects; killed only explicitly or on process exit.
const sessions = new Map();
const MAX_BUFFER = 100 * 1024; // 100 KB of recent output kept per session

function sanitize(s) {
  return (typeof s === "string" ? s : "").replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // Kill a named session (called by "New session" button in TerminalWidget)
    if (parsedUrl.pathname === "/_terminal/kill" && req.method === "POST") {
      const name = sanitize(parsedUrl.query.session);
      const session = sessions.get(name);
      if (session) {
        try { session.shell.kill(); } catch {}
        sessions.delete(name);
      }
      res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      return;
    }

    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/_terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    const { query } = parse(req.url, true);
    const cmd = sanitize(query.cmd) || "bash";
    const sessionName = sanitize(query.session) || cmd;

    let session = sessions.get(sessionName);

    if (!session) {
      // Spawn a new pty for this session
      const env = {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        HOME: process.env.HOME || "/root",
      };

      // "bash" means "the host's default shell" (cross-platform); anything else (e.g. "claude")
      // is run directly. The custom user@host prompt is bash-specific and POSIX-only.
      let shellCmd = cmd;
      let args = [];
      if (cmd === "bash") {
        shellCmd = defaultShell();
        if (process.platform !== "win32" && /bash$/.test(shellCmd)) {
          const tc = getTerminalConfig();
          if (tc.configured) {
            env.HOME = tc.home;
            args = bashArgsFor(tc);
          }
        }
      }

      let shell;
      try {
        shell = pty.spawn(shellCmd, args, {
          name: "xterm-256color",
          cols: 120,
          rows: 30,
          env,
        });
      } catch (err) {
        // Never let a spawn failure crash the server — report it to the client and bail.
        try {
          ws.send(`\r\n\x1b[31mFailed to start terminal ("${shellCmd}"): ${err.message}\x1b[0m\r\n`);
          ws.close();
        } catch {}
        return;
      }

      session = { shell, buffer: "", ws: null };
      sessions.set(sessionName, session);

      shell.onData((data) => {
        // Append to rolling buffer
        session.buffer += data;
        if (session.buffer.length > MAX_BUFFER) {
          session.buffer = session.buffer.slice(session.buffer.length - MAX_BUFFER);
        }
        // Forward to current WebSocket if connected
        if (session.ws && session.ws.readyState === session.ws.OPEN) {
          session.ws.send(data);
        }
      });

      shell.onExit(() => {
        // Process exited (user typed "exit"): clean up
        sessions.delete(sessionName);
        if (session.ws && session.ws.readyState === session.ws.OPEN) {
          session.ws.close();
        }
      });
    }

    // Attach this WebSocket to the session
    session.ws = ws;

    // Replay recent output so reconnecting clients see context
    if (session.buffer) {
      ws.send(session.buffer);
    }

    // Send current terminal size to pty
    ws.send("\r\n");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "resize") {
          session.shell.resize(msg.cols, msg.rows);
        } else if (msg.type === "data") {
          // Log what xterm sends back so we can debug __ issue
          if (process.env.DEBUG_TERM) {
            const hex = Buffer.from(msg.data).toString('hex');
            if (hex.includes('5f5f')) console.log('[DEBUG stdin contains __]', JSON.stringify(msg.data));
            else console.log('[DEBUG stdin]', JSON.stringify(msg.data));
          }
          session.shell.write(msg.data);
        }
      } catch {
        session.shell.write(data.toString());
      }
    });

    ws.on("close", () => {
      // Detach: keep the pty alive, just clear the ws reference
      if (session.ws === ws) session.ws = null;
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
