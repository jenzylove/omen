/**
 * GitHub MCP leg — pulls internal evidence from the org's own history:
 *   - Closed issues labelled "incident" or "postmortem"
 *   - Merged PRs with reviewer-flagged risk comments
 *   - Recent retro documents in the repo (RETRO.md, postmortem/*.md)
 *
 * Uses GitHub REST API via fetch (no extra SDK needed).
 * The grounding engine calls this to populate internalHistory.
 */
import type { Evidence } from "../types.js";

interface GHIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: { name: string }[];
  closed_at: string | null;
}

interface GHPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
}

interface GHSearchResult<T> {
  items: T[];
}

export interface GitHubReaderOptions {
  token: string;
  /** e.g. "acme-org/payments" — inferred from the channel name or passed explicitly */
  repo: string;
  /** Terms pulled from the Slack conversation to narrow the search */
  keywords: string[];
}

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/** Extract a one-line snippet from a potentially long body. */
function snippet(body: string | null, maxLen = 140): string {
  if (!body) return "";
  const clean = body.replace(/<!--[\s\S]*?-->/g, "").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
}

export async function gatherInternalHistory(
  opts: GitHubReaderOptions,
): Promise<Evidence[]> {
  const { token, repo, keywords } = opts;
  const evidence: Evidence[] = [];
  const base = "https://api.github.com";
  const q = encodeURIComponent(
    `repo:${repo} ${keywords.slice(0, 3).join(" ")} is:closed`,
  );

  // 1. Incidents + postmortems from issues
  try {
    const issueSearch = await ghFetch<GHSearchResult<GHIssue>>(
      `${base}/search/issues?q=${q}+label:incident,postmortem&sort=updated&per_page=5`,
      token,
    );
    for (const issue of issueSearch.items) {
      const snip = snippet(issue.body);
      if (!snip) continue;
      evidence.push({
        source: "internal",
        label: `#${issue.number} ${issue.title}`,
        url: issue.html_url,
        snippet: snip,
      });
    }
  } catch (err) {
    console.warn("[omen/github] issue search failed:", (err as Error).message);
  }

  // 2. Merged PRs that match keywords — look for reviewer risk signals in body
  try {
    const prSearch = await ghFetch<GHSearchResult<GHPullRequest>>(
      `${base}/search/issues?q=${q}+is:pr+is:merged&sort=updated&per_page=8`,
      token,
    );
    for (const pr of prSearch.items) {
      const body = pr.body ?? "";
      const hasRisk =
        /no test|missing test|skipped|risk|concern|flagged|reviewer/i.test(body);
      if (!hasRisk) continue;
      evidence.push({
        source: "internal",
        label: `PR #${pr.number} ${pr.title}`,
        url: pr.html_url,
        snippet: snippet(body),
      });
    }
  } catch (err) {
    console.warn("[omen/github] PR search failed:", (err as Error).message);
  }

  return evidence.slice(0, 6); // cap: Claude context is precious
}

/**
 * Infer likely keywords from the Slack conversation for the GitHub search.
 * Simple heuristic: nouns 5+ chars that appear 2+ times, excluding stop-words.
 */
export function extractKeywords(messages: { text: string }[]): string[] {
  const stop = new Set([
    "there", "about", "which", "would", "could", "should", "their", "going",
    "where", "while", "these", "those", "being", "still", "right", "things",
  ]);
  const freq = new Map<string, number>();
  for (const { text } of messages) {
    for (const word of text.toLowerCase().match(/[a-z]{5,}/g) ?? []) {
      if (!stop.has(word)) freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}
