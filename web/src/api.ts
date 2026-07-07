import type { FailureForecast } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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
    headers: { "Content-Type": "application/json" },
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
