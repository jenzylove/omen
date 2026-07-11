/**
 * REST + SSE API — feeds the React dashboard.
 *
 * Endpoints:
 *   GET /api/forecasts          → all forecasts (latest first)
 *   GET /api/forecasts/:id      → single forecast by channelId
 *   GET /api/events             → SSE stream; emits {type:"forecast", data} on every new run
 *
 * Auth: all mutation endpoints require X-API-Key header matching OMEN_API_KEY env var.
 * GET endpoints are unauthenticated (read-only) for the demo dashboard.
 * Set OMEN_API_KEY to a non-empty value to enable auth.
 */
import http from "node:http";
import { getAllForecasts, getForecast, onForecastSaved } from "./store.js";
import type { FailureForecast } from "./types.js";

type SSEClient = http.ServerResponse;
const clients = new Set<SSEClient>();

const API_KEY = process.env.OMEN_API_KEY || "";

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!API_KEY) return true; // no key configured = open (local dev)
  return req.headers["x-api-key"] === API_KEY;
}

const ALLOWED_ORIGIN = process.env.OMEN_ALLOWED_ORIGIN || "*";

function setCors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function unauthorized(res: http.ServerResponse): void {
  setCors(res);
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
}

/** Called by the store whenever a forecast is saved — pushes to all SSE subscribers. */
function broadcast(forecast: FailureForecast): void {
  const payload = `data: ${JSON.stringify({ type: "forecast", data: forecast })}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// Wire up the store callback once at module load
onForecastSaved(broadcast);

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  // CORS headers must be set BEFORE writeHead — setHeader() throws once headers
  // are flushed, which would crash the request handler.
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    let size = 0;
    const MAX = 1024 * 100; // 100KB body limit
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX) {
        req.destroy();
        resolve({ error: "payload too large" });
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** Injected by app.ts — runs the full grounding + synthesis pipeline and saves. */
export type RunForecast = (channelId: string, launchName: string) => Promise<FailureForecast>;

export interface ApiOptions {
  runForecast: RunForecast;
}

export function createApiServer(port: number, opts: ApiOptions): http.Server {
  const requestCounts = new Map<string, number>();
  const RATE_LIMIT = 10; // max requests per IP per window
  const RATE_WINDOW_MS = 60_000; // 1 minute window

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const path = url.pathname;
    const ip = req.socket.remoteAddress || "unknown";

    // Rate-limit bookkeeping — enforced on POST only (see below). Use "|" not ":"
    // as the separator so IPv6 addresses (e.g. "::1") don't corrupt the window key.
    const now = Date.now();
    const windowStart = Math.floor(now / RATE_WINDOW_MS);
    const rateKey = `${ip}|${windowStart}`;

    // CORS preflight
    if (req.method === "OPTIONS") {
      setCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /api/forecast  — trigger/re-run a forecast from the dashboard
    if (req.method === "POST" && path === "/api/forecast") {
      if (!isAuthorized(req)) return void unauthorized(res);

      // Rate limit POST only — GET/SSE traffic must not consume the budget,
      // or a dashboard that reconnects a few times would 429 a legit re-run.
      const current = requestCounts.get(rateKey) || 0;
      if (current >= RATE_LIMIT) {
        setCors(res);
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "too many requests" }));
        return;
      }
      requestCounts.set(rateKey, current + 1);
      // Opportunistic cleanup of stale windows
      if (requestCounts.size > 100) {
        for (const [k] of requestCounts) {
          const ts = parseInt(k.split("|")[1], 10);
          if (windowStart - ts > 2) requestCounts.delete(k);
        }
      }

      void (async () => {
        const body = await readJsonBody(req);
        if (body.error) return json(res, 400, { error: "payload too large" });
        const launchName = String(body.launchName ?? "").trim();
        if (!launchName) return json(res, 400, { error: "launchName required" });
        const channelId =
          String(body.channelId ?? "").trim() ||
          `web-${launchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
        try {
          const forecast = await opts.runForecast(channelId, launchName);
          return json(res, 200, forecast);
        } catch (err) {
          console.error("[omen/api] runForecast failed:", err);
          return json(res, 500, { error: "forecast failed" });
        }
      })();
      return;
    }

    // GET /api/forecasts
    if (req.method === "GET" && path === "/api/forecasts") {
      return json(res, 200, getAllForecasts());
    }

    // GET /api/forecasts/:channelId
    const forecastMatch = path.match(/^\/api\/forecasts\/(.+)$/);
    if (req.method === "GET" && forecastMatch) {
      const forecast = getForecast(decodeURIComponent(forecastMatch[1]));
      return forecast
        ? json(res, 200, forecast)
        : json(res, 404, { error: "not found" });
    }

    // GET /api/events  — SSE (read-only, no auth required)
    if (req.method === "GET" && path === "/api/events") {
      setCors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");

      // Send current state immediately so the dashboard doesn't start blank
      const all = getAllForecasts();
      if (all.length) {
        res.write(`data: ${JSON.stringify({ type: "init", data: all })}\n\n`);
      }

      clients.add(res);
      req.on("close", () => clients.delete(res));

      // Heartbeat every 30s to detect dead connections
      const heartbeat = setInterval(() => {
        try {
          res.write(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
          clients.delete(res);
        }
      }, 30_000);

      req.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(res);
      });
      return;
    }

    json(res, 404, { error: "not found" });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️  API port ${port} already in use — is another Omen server running?`);
    } else {
      console.error("[omen/api] server error:", err.message);
    }
  });

  server.listen(port, () => {
    console.log(`🔮 Omen API listening on http://localhost:${port}`);
  });

  return server;
}
