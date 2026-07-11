import type { FailureForecast } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// Optional — only needed if the hosted backend sets OMEN_API_KEY to gate POSTs.
// Note: bundled into the client, so this is basic abuse-deterrence for a demo
// (paired with the server's per-IP rate limit + CORS origin lock), not a secret.
const API_KEY = import.meta.env.VITE_OMEN_API_KEY ?? "";

function postHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  return headers;
}

export async function fetchForecasts(): Promise<FailureForecast[]> {
  const res = await fetch(`${BASE}/api/forecasts`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Trigger a new forecast (or re-run an existing one by passing its channelId). */
export async function runForecast(
  launchName: string,
  channelId?: string,
): Promise<FailureForecast> {
  const res = await fetch(`${BASE}/api/forecast`, {
    method: "POST",
    headers: postHeaders(),
    body: JSON.stringify({ launchName, channelId }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Subscribe to live forecast updates via SSE. Returns an unsubscribe fn. */
export function subscribeToForecasts(
  onInit: (forecasts: FailureForecast[]) => void,
  onForecast: (forecast: FailureForecast) => void,
): () => void {
  const es = new EventSource(`${BASE}/api/events`);

  es.onmessage = (e) => {
    const msg = JSON.parse(e.data) as
      | { type: "init"; data: FailureForecast[] }
      | { type: "forecast"; data: FailureForecast };

    if (msg.type === "init") onInit(msg.data);
    else if (msg.type === "forecast") onForecast(msg.data);
  };

  return () => es.close();
}
