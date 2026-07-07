/**
 * Slack reader — pulls the raw context Omen grounds its forecast in:
 *   1. The channel conversation (recent messages, oldest→newest)
 *   2. A spec baseline (a pinned canvas / PRD / kickoff message, if present)
 *
 * This is data access via the Slack Web API (conversations.history, pins.list).
 * The AI reasoning — detecting scope drift and predicting failures — is done by
 * Claude in forecast.ts, not here. We do NOT claim regex heuristics as "AI".
 */
import type { WebClient } from "@slack/web-api";

export interface ConversationMessage {
  user: string;
  text: string;
  ts: string;
}

export interface SlackReaderResult {
  conversation: ConversationMessage[];
  specBaseline: string | undefined;
}

/** How many messages to pull. Slack returns max 1000; 200 is plenty for a project channel. */
const MAX_MESSAGES = 200;

export async function readChannel(
  client: WebClient,
  channelId: string,
): Promise<SlackReaderResult> {
  const historyRes = await client.conversations.history({
    channel: channelId,
    limit: MAX_MESSAGES,
  });

  const conversation: ConversationMessage[] = (historyRes.messages ?? [])
    .filter((m) => m.type === "message" && !m.subtype && m.text)
    .reverse() // oldest first
    .map((m) => ({
      user: m.username ?? m.user ?? "unknown",
      text: m.text ?? "",
      ts: m.ts ?? "",
    }));

  const specBaseline = await extractSpecBaseline(client, channelId);

  return { conversation, specBaseline };
}

async function extractSpecBaseline(
  client: WebClient,
  channelId: string,
): Promise<string | undefined> {
  try {
    const pinsRes = await client.pins.list({ channel: channelId });
    for (const pin of pinsRes.items ?? []) {
      const text: string =
        (pin as Record<string, unknown> & { message?: { text?: string } })?.message?.text ?? "";
      if (
        text.length > 50 &&
        /scope|spec|kickoff|objective|goal|we are building|this (project|launch)/i.test(text)
      ) {
        return text.slice(0, 1500);
      }
    }
  } catch {
    // pins.list may 403 in some workspaces — not fatal.
  }
  return undefined;
}
