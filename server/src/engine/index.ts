/**
 * Engine orchestrator — the one call the Slack layer makes.
 *
 *   generateForecast(channelId, launchName) → FailureForecast
 *
 * Computes a diff against the previous forecast for this channel so the
 * Slack message and dashboard can show what changed since the last run.
 */
import type { FailureForecast, ForecastDiff } from "../types.js";
import { gatherContext, type GroundingDeps } from "./grounding.js";
import { synthesizeForecast } from "./forecast.js";
import { SAMPLE_FORECAST } from "./fixtures.js";
import { getForecast } from "../store.js";

export interface EngineDeps extends GroundingDeps {
  apiKey?: string;
  model?: string;
}

export function computeDiff(prev: FailureForecast, next: FailureForecast): ForecastDiff {
  const prevIds = new Set(prev.failureModes.map((m) => m.id));
  const nextIds = new Set(next.failureModes.map((m) => m.id));
  return {
    scoreDelta: next.readinessScore - prev.readinessScore,
    newFailureModeIds: next.failureModes.filter((m) => !prevIds.has(m.id)).map((m) => m.id),
    resolvedFailureModeIds: prev.failureModes.filter((m) => !nextIds.has(m.id)).map((m) => m.id),
    previousGeneratedAt: prev.generatedAt,
  };
}

export async function generateForecast(
  channelId: string,
  launchName: string,
  deps: EngineDeps = {},
): Promise<FailureForecast> {
  const previous = getForecast(channelId);
  const ctx = await gatherContext(channelId, launchName, {
    slackToken: deps.slackToken,
    slackUserToken: deps.slackUserToken,
    githubToken: deps.githubToken,
    githubRepo: deps.githubRepo,
  });

  let forecast: FailureForecast;

  if (!deps.apiKey) {
    forecast = { ...SAMPLE_FORECAST, channelId, launchName, provenance: ctx.provenance, generatedAt: new Date().toISOString() };
  } else {
    try {
      forecast = await synthesizeForecast(ctx, { apiKey: deps.apiKey, model: deps.model });
    } catch (err) {
      console.error("[omen] forecast synthesis failed, using fixture:", err);
      forecast = { ...SAMPLE_FORECAST, channelId, launchName, provenance: ctx.provenance, generatedAt: new Date().toISOString() };
    }
  }

  if (previous) {
    forecast = { ...forecast, diff: computeDiff(previous, forecast) };
  }

  return forecast;
}

export { computeReadinessScore } from "./forecast.js";
