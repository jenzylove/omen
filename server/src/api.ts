/**
 * REST + SSE API — feeds the React dashboard.
 *
 * Endpoints:
 *   GET /api/forecasts          → all forecasts (latest first)
 *   GET /api/forecasts/:id      → single forecast by channelId
 *   GET /api/events             → SSE stream; emits {type:"forecast", data} on every new run
 *
 * Started alongside the Bolt Socket Mode app in app.ts.
 * No extra framework — raw Node http so there's nothing new to install.
 */
import http from "node:http";
import { getAllForecasts, getForecast, onForecastSaved } from "./store.js";
import type { FailureForecast } from "./types.js";

type SSEClient = http.ServerResponse;
const clients = new Set<SSEClient>();

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
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
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
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
      res.end();
      return;
    }

    // POST /api/forecast  — trigger/re-run a forecast from the dashboard
    if (req.method === "POST" && path === "/api/forecast") {
      void (async () => {
        const body = await readJsonBody(req);
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

    // GET /api/events  — SSE
    if (req.method === "GET" && path === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": connected\n\n");
      clients.add(res);

      // Send current state immediately so the dashboard doesn't start blank
      const all = getAllForecasts();
      if (all.length) {
        res.write(`data: ${JSON.stringify({ type: "init", data: all })}\n\n`);
      }

      req.on("close", () => clients.delete(res));
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
