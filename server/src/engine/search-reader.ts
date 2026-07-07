/**
 * Real-time search leg — finds external comparable failures.
 *
 * Primary source: the Tavily real-time search API (https://tavily.com) — a
 * genuine real-time web search that surfaces how comparable launches/migrations
 * failed at other companies. This is the "real-time search API" required tech.
 *
 * Secondary (optional): Slack message search for past internal discussions.
 * NOTE: Slack's search.messages requires a *user* token (search:read is a user
 * scope) — it does NOT work with a bot token. So this only runs when a
 * SLACK_USER_TOKEN is provided; otherwise it's skipped cleanly.
 */
import type { WebClient } from "@slack/web-api";
import type { Evidence } from "../types.js";

// ── Tavily real-time web search (external comparables) ────────────────────────

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

export async function searchExternalComparables(
  keywords: string[],
  launchName: string,
): Promise<Evidence[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return []; // not configured — grounding.ts marks this leg as demo

  const query =
    `How have launches like "${launchName}" failed? ` +
    `postmortem OR incident OR outage ${keywords.slice(0, 4).join(" ")}`;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 4,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      console.warn(`[omen/search] Tavily ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { results?: TavilyResult[] };
    return (data.results ?? [])
      .filter((r) => r.content && r.url)
      .slice(0, 4)
      .map((r) => ({
        source: "external" as const,
        label: r.title ?? new URL(r.url!).hostname,
        url: r.url,
        snippet: (r.content ?? "").slice(0, 180),
      }));
  } catch (err) {
    console.warn("[omen/search] Tavily search failed:", (err as Error).message);
    return [];
  }
}

// ── Slack message search (optional, needs a user token) ───────────────────────

export interface SlackSearchOptions {
  userClient: WebClient; // must be built from a user token (xoxp-), not a bot token
  keywords: string[];
  launchName: string;
}

export async function searchSlackHistory(
  opts: SlackSearchOptions,
): Promise<Evidence[]> {
  const { userClient, keywords, launchName } = opts;
  const query = `${launchName} incident OR outage OR failure OR postmortem ${keywords.slice(0, 3).join(" ")}`;
  const results: Evidence[] = [];

  try {
    const res = await userClient.search.messages({ query, count: 8, sort: "score" });
    const matches = res.messages?.matches ?? [];
    for (const match of matches) {
      const m = match as {
        text?: string;
        permalink?: string;
        username?: string;
        channel?: { name?: string };
      };
      if (!m.text || m.text.length < 40) continue;
      results.push({
        source: "internal",
        label: `#${m.channel?.name ?? "channel"} — ${m.username ?? "someone"}`,
        url: m.permalink,
        snippet: m.text.slice(0, 140),
      });
    }
  } catch (err) {
    console.warn("[omen/search] Slack search failed:", (err as Error).message);
  }

  return results.slice(0, 3);
}
