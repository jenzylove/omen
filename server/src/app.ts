/**
 * Omen — Slack app entrypoint.
 *
 * Surfaces:
 *   /omen [launch name]   → posts a grounded failure forecast in-channel
 *   App Home tab          → readiness gauge + all active forecasts
 *
 * Interactions:
 *   omen_ack_mitigation   → mark a failure mode's mitigation as accepted
 *   omen_rerun            → re-run the forecast for this channel
 *   omen_view_forecast    → open a modal with the full forecast (from App Home)
 */
import "dotenv/config";
import type { KnownBlock, View } from "@slack/types";
import type { WebClient } from "@slack/web-api";
import pkg from "@slack/bolt";
const { App, LogLevel } = pkg;
import { generateForecast } from "./engine/index.js";
import type { FailureForecast } from "./types.js";
import { forecastBlocks, appHomeBlocks, forecastModal } from "./render/blocks.js";
import { createApiServer } from "./api.js";
import { seedDemoData } from "./seed.js";
import {
  saveForecast,
  getForecast,
  getAllForecasts,
  acknowledgeMitigation,
  getAcknowledged,
} from "./store.js";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

const engineDeps = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.OMEN_MODEL,
  slackToken: process.env.SLACK_BOT_TOKEN,
  slackUserToken: process.env.SLACK_USER_TOKEN,
  githubToken: process.env.GITHUB_TOKEN,
  githubRepo: process.env.GITHUB_REPO,
};

// Hard ceiling so a stalled forecast can never leave the user staring at a
// spinner — if synthesis exceeds this, the handler reports a retryable error.
const FORECAST_TIMEOUT_MS = 120_000;
function generateBounded(channelId: string, launchName: string): Promise<FailureForecast> {
  return Promise.race([
    generateForecast(channelId, launchName, engineDeps),
    new Promise<FailureForecast>((_, reject) =>
      setTimeout(
        () => reject(new Error(`forecast timed out after ${FORECAST_TIMEOUT_MS}ms`)),
        FORECAST_TIMEOUT_MS,
      ),
    ),
  ]);
}

// ── /omen command ─────────────────────────────────────────────────────────────

app.command("/omen", async ({ command, ack, respond, client }) => {
  await ack();

  const launchName = command.text?.trim() || `#${command.channel_name} launch`;

  await respond({
    response_type: "ephemeral",
    text: `🔮 Reading the omens for *${launchName}*… gathering your history and comparable failures.`,
  });

  try {
    const forecast = await generateBounded(command.channel_id, launchName);
    saveForecast(forecast);

    // Post as a real bot message (not a response_url reply) so the interactive
    // Accept-mitigation / Re-run buttons can reliably chat.update it afterwards.
    await client.chat.postMessage({
      channel: command.channel_id,
      blocks: forecastBlocks(forecast, getAcknowledged(forecast.channelId)) as KnownBlock[],
      text: `Omen forecast for ${launchName}: readiness ${forecast.readinessScore}/100`,
    });

    await refreshAppHome(client, command.user_id);
  } catch (err) {
    console.error("[omen] /omen failed:", err);
    await respond({
      response_type: "ephemeral",
      text: "⚠️ Omen couldn't complete the forecast. Check the server logs.",
    });
  }
});

// ── App Home ──────────────────────────────────────────────────────────────────

app.event("app_home_opened", async ({ event, client }) => {
  if (event.tab !== "home") return;
  await refreshAppHome(client, event.user);
});

async function refreshAppHome(client: WebClient, userId: string): Promise<void> {
  try {
    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: appHomeBlocks(getAllForecasts()) as KnownBlock[],
      },
    });
  } catch (err) {
    console.warn("[omen] App Home refresh failed:", (err as Error).message);
  }
}

// ── Interactions ──────────────────────────────────────────────────────────────

app.action("omen_ack_mitigation", async ({ ack, action, client, body }) => {
  await ack();

  const { channelId, failureModeId } = JSON.parse(
    (action as { value: string }).value,
  ) as { channelId: string; failureModeId: string };

  acknowledgeMitigation(channelId, failureModeId);
  const forecast = getForecast(channelId);
  if (!forecast) return;

  const acked = getAcknowledged(channelId);
  const rawBody = body as unknown as Record<string, unknown>;
  const message = rawBody["message"] as Record<string, unknown> | undefined;
  const ts = message?.["ts"] as string | undefined;
  const channel = (message?.["channel"] as string | undefined) ?? channelId;

  if (ts) {
    await client.chat.update({
      channel,
      ts,
      blocks: forecastBlocks(forecast, acked) as KnownBlock[],
      text: `Omen forecast for ${forecast.launchName}: readiness ${forecast.readinessScore}/100`,
    });
  }
});

app.action("omen_rerun", async ({ ack, action, client, body }) => {
  await ack();

  const { channelId, launchName } = JSON.parse(
    (action as { value: string }).value,
  ) as { channelId: string; launchName: string };

  const userId = body.user.id;

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `🔮 Re-reading the omens for *${launchName}*…`,
  });

  try {
    const forecast = await generateBounded(channelId, launchName);
    saveForecast(forecast);

    const rawBody = body as unknown as Record<string, unknown>;
    const message = rawBody["message"] as Record<string, unknown> | undefined;
    const ts = message?.["ts"] as string | undefined;
    const blocks = forecastBlocks(forecast, new Set()) as KnownBlock[];
    const text = `Omen forecast for ${launchName}: readiness ${forecast.readinessScore}/100`;

    // Update the original forecast in place; if the edit can't be applied, post
    // the refreshed forecast as a new message so a re-run never dead-ends.
    try {
      if (ts) await client.chat.update({ channel: channelId, ts, blocks, text });
      else await client.chat.postMessage({ channel: channelId, blocks, text });
    } catch (updateErr) {
      console.warn("[omen] re-run update failed, posting fresh:", (updateErr as Error).message);
      await client.chat.postMessage({ channel: channelId, blocks, text });
    }

    await refreshAppHome(client, userId);
  } catch (err) {
    console.error("[omen] re-run failed:", err);
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "⚠️ Re-run failed. Check the server logs.",
    });
  }
});

app.action("omen_view_forecast", async ({ ack, action, client, body }) => {
  await ack();

  const channelId = (action as { value: string }).value;
  const forecast = getForecast(channelId);
  if (!forecast) return;

  const rawBody = body as unknown as Record<string, unknown>;
  const triggerId = rawBody["trigger_id"] as string | undefined;
  if (!triggerId) return;

  await client.views.open({
    trigger_id: triggerId,
    view: forecastModal(forecast, getAcknowledged(channelId)) as unknown as View,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

// The dashboard API must own the platform's public port ($PORT on Railway/Render),
// since that's the one URL the hosted frontend can reach. Bolt runs Socket Mode —
// it connects OUT to Slack over a WebSocket and never needs a public inbound port,
// so it gets its own separate internal port and never contends for $PORT.
const apiPort = Number(process.env.PORT) || Number(process.env.API_PORT) || 3001;
const boltPort = Number(process.env.BOLT_PORT) || 3000;

// Bring up the dashboard API + seed data FIRST, so the web dashboard works even
// if Slack credentials are missing/invalid (the Socket Mode app is optional).
if (process.env.DEMO_SEED !== "false") seedDemoData();
createApiServer(apiPort, {
  // Dashboard "New forecast" / "Re-run" runs the same pipeline as /omen.
  runForecast: async (channelId, launchName) => {
    const forecast = await generateForecast(channelId, launchName, engineDeps);
    saveForecast(forecast); // triggers the SSE broadcast → dashboard updates live
    return forecast;
  },
});

try {
  await app.start(boltPort);
  console.log(`🔮 Omen is watching. (Slack Socket Mode :${boltPort}, API :${apiPort})`);
} catch (err) {
  console.warn(
    `⚠️  Slack Socket Mode failed to start — dashboard/API still running on :${apiPort}.`,
    (err as Error).message,
  );
}
