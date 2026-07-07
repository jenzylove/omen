/**
 * SQLite-backed store — forecasts survive server restarts.
 *
 * Keeps the same interface as the previous in-memory store so no callers change.
 * DB file: ./omen.db (relative to process.cwd(), i.e. the server/ directory).
 *
 * Acknowledged mitigations are ephemeral (in-memory) — they're interactive
 * per-session state and re-clicking them after a restart takes seconds.
 */
import Database from "better-sqlite3";
import type { FailureForecast } from "./types.js";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "omen.db");

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS forecasts (
    channel_id  TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`);

const acknowledged = new Map<string, Set<string>>(); // channelId → Set<failureModeId>
const listeners: ((f: FailureForecast) => void)[] = [];

export function onForecastSaved(cb: (f: FailureForecast) => void): void {
  listeners.push(cb);
}

export function saveForecast(forecast: FailureForecast): void {
  db.prepare(
    "INSERT OR REPLACE INTO forecasts (channel_id, data, updated_at) VALUES (?, ?, ?)",
  ).run(forecast.channelId, JSON.stringify(forecast), forecast.generatedAt);

  for (const cb of listeners) cb(forecast);
}

export function getForecast(channelId: string): FailureForecast | undefined {
  const row = db.prepare("SELECT data FROM forecasts WHERE channel_id = ?").get(channelId) as
    | { data: string }
    | undefined;
  return row ? (JSON.parse(row.data) as FailureForecast) : undefined;
}

export function getAllForecasts(): FailureForecast[] {
  const rows = db.prepare("SELECT data FROM forecasts ORDER BY updated_at DESC").all() as {
    data: string;
  }[];
  return rows.map((r) => JSON.parse(r.data) as FailureForecast);
}

export function getForecastCount(): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM forecasts").get() as { n: number };
  return row.n;
}

export function acknowledgeMitigation(channelId: string, failureModeId: string): void {
  if (!acknowledged.has(channelId)) acknowledged.set(channelId, new Set());
  acknowledged.get(channelId)!.add(failureModeId);
}

export function getAcknowledged(channelId: string): Set<string> {
  return acknowledged.get(channelId) ?? new Set();
}
