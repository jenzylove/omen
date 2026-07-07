/**
 * Grounding engine — assembles the context Omen reasons over.
 *
 * Three live sources:
 *
 *   1. Slack        → channel history + spec baseline (slack-reader). The AI
 *                     reasoning itself is Claude; Slack provides the raw context.
 *   2. MCP (GitHub) → past incidents + risky PRs, fetched through a real MCP
 *                     server/client over stdio (mcp/github-client → github-server).
 *   3. Real-time    → external comparable failures via the Tavily search API,
 *      search API     plus optional Slack message search (search-reader).
 *
 * Each leg falls back to demo fixtures if unconfigured, and records whether it
 * ran live vs demo in `provenance` so the UI never presents seed data as real.
 */
import { WebClient } from "@slack/web-api";
import type { GroundingContext, Provenance } from "../types.js";
import { SAMPLE_CONTEXT } from "./fixtures.js";
import { readChannel } from "./slack-reader.js";
import { extractKeywords } from "./github-reader.js";
import { gatherInternalHistoryViaMCP } from "../mcp/github-client.js";
import { searchSlackHistory, searchExternalComparables } from "./search-reader.js";

export interface GroundingDeps {
  slackToken?: string;
  /** User token (xoxp-) for search.messages — optional; bot tokens can't search. */
  slackUserToken?: string;
  githubToken?: string;
  githubRepo?: string;
}

export async function gatherContext(
  channelId: string,
  launchName: string,
  deps: GroundingDeps = {},
): Promise<GroundingContext> {
  const { slackToken, slackUserToken, githubToken, githubRepo } = deps;
  const provenance: Provenance = {
    conversation: "demo",
    internalHistory: "demo",
    externalComparables: "demo",
  };

  // ── Leg 1: Slack (conversation + spec baseline) ──────────────────────────
  let conversation = SAMPLE_CONTEXT.conversation;
  let specBaseline = SAMPLE_CONTEXT.specBaseline;

  if (slackToken) {
    try {
      const slackResult = await readChannel(new WebClient(slackToken), channelId);
      if (slackResult.conversation.length) {
        conversation = slackResult.conversation;
        specBaseline = slackResult.specBaseline ?? specBaseline;
        provenance.conversation = "live";
      }
      console.log(`[omen/grounding] Slack: ${conversation.length} messages, baseline: ${!!specBaseline}`);
    } catch (err) {
      console.warn("[omen/grounding] Slack read failed, using fixture:", (err as Error).message);
    }
  }

  const keywords = extractKeywords(conversation);

  // ── Leg 2: GitHub via MCP (internal history) ─────────────────────────────
  let internalHistory = SAMPLE_CONTEXT.internalHistory;

  if (githubToken && githubRepo) {
    try {
      const ghResults = await gatherInternalHistoryViaMCP(githubRepo, keywords, githubToken);
      if (ghResults.length) {
        internalHistory = ghResults;
        provenance.internalHistory = "live";
      }
      console.log(`[omen/grounding] GitHub (MCP): ${ghResults.length} evidence items`);
    } catch (err) {
      console.warn("[omen/grounding] GitHub MCP read failed, using fixture:", (err as Error).message);
    }
  }

  // ── Leg 3: Real-time search API (Tavily) + optional Slack user search ─────
  let externalComparables = SAMPLE_CONTEXT.externalComparables;

  try {
    const slackSearch = slackUserToken
      ? searchSlackHistory({ userClient: new WebClient(slackUserToken), keywords, launchName })
      : Promise.resolve([] as typeof externalComparables);

    const [externalResults, slackResults] = await Promise.all([
      searchExternalComparables(keywords, launchName),
      slackSearch,
    ]);

    const combined = [...externalResults, ...slackResults];
    if (combined.length) {
      externalComparables = combined;
      provenance.externalComparables = "live";
    }
    console.log(`[omen/grounding] Search: ${combined.length} results (${externalResults.length} Tavily, ${slackResults.length} Slack)`);
  } catch (err) {
    console.warn("[omen/grounding] Search failed, using fixture:", (err as Error).message);
  }

  return {
    launchName,
    channelId,
    conversation,
    specBaseline,
    internalHistory,
    externalComparables,
    provenance,
  };
}
