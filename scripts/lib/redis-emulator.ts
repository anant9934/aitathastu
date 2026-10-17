/**
 * In-memory Upstash Redis REST emulator for isolated local contract testing.
 * Implements /pipeline endpoint for atomic INCRBY, EXPIRE, GET, SET, DEL.
 * Strictly bound to 127.0.0.1. Zero production network access.
 */
import http from "node:http";

export function createRedisEmulator(port = 18079): Promise<http.Server> {
  const store = new Map<string, string | number>();
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && (req.url === "/pipeline" || req.url?.startsWith("/pipeline"))) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const commands: (string | number)[][] = JSON.parse(body || "[]");
          const results = commands.map(([cmd, ...args]) => {
            const upper = String(cmd).toUpperCase();
            if (upper === "DEL") {
              let count = 0;
              for (const k of args) {
                if (store.delete(String(k))) count++;
              }
              return { result: count };
            }
            if (upper === "GET") {
              const val = store.get(String(args[0]));
              return { result: val !== undefined ? String(val) : null };
            }
            if (upper === "SET") {
              store.set(String(args[0]), String(args[1]));
              return { result: "OK" };
            }
            if (upper === "INCRBY" || upper === "INCR") {
              const key = String(args[0]);
              const by = upper === "INCR" ? 1 : Number(args[1]) || 0;
              const cur = Number(store.get(key) || 0) + by;
              store.set(key, cur);
              return { result: cur };
            }
            if (upper === "EXPIRE") {
              return { result: 1 };
            }
            return { result: "OK" };
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(results));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

if (process.argv[1] && process.argv[1].includes("redis-emulator")) {
  createRedisEmulator().then(() => {
    console.log("Redis emulator listening on http://127.0.0.1:18079");
  }).catch((err) => {
    console.error("Failed to start Redis emulator:", err);
    process.exit(1);
  });
}
