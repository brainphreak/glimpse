export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import http from "http";

const SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

// Talk to the Docker Engine API over its unix socket.
function dockerGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCKET, path, method: "GET", timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if ((res.statusCode || 500) >= 400) return reject(new Error(`Docker API ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Docker socket timeout")));
    req.on("error", reject);
    req.end();
  });
}

interface DockerContainer {
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

export async function GET() {
  try {
    const list = (await dockerGet("/v1.41/containers/json?all=1")) as DockerContainer[];
    const containers = list.map((c) => ({
      name: (c.Names?.[0] || "").replace(/^\//, ""),
      image: c.Image,
      state: c.State,        // running | exited | paused | ...
      status: c.Status,      // "Up 3 hours" / "Exited (0) 2 days ago"
    }));
    return NextResponse.json({ containers });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    const enoent = msg.includes("ENOENT") || msg.includes("connect");
    return NextResponse.json(
      { error: enoent
          ? "Docker socket not reachable. Mount it read-only into the container: add '- /var/run/docker.sock:/var/run/docker.sock:ro' to docker-compose.yml."
          : msg },
      { status: 503 }
    );
  }
}
