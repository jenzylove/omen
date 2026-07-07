/**
 * MCP client for GitHub grounding.
 *
 * Two modes (env `GITHUB_MCP_MODE`):
 *   - "local" (default): spawns our own github-server.ts over stdio and calls
 *     `search_internal_history`. No network endpoint dependency — reliable for demos.
 *   - "remote": connects to GitHub's OFFICIAL remote MCP server
 *     (https://api.githubcopilot.com/mcp/) over Streamable HTTP, authenticates with
 *     the PAT, and calls its `search_issues` tool. Proves real third-party MCP
 *     integration; adds a network dependency, so it's opt-in.
 *
 * Either way the grounding engine only ever talks MCP — never GitHub REST directly.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fileURLToPath } from "node:url";
import type { Evidence } from "../types.js";

const serverPath = fileURLToPath(new URL("./github-server.ts", import.meta.url));
const REMOTE_MCP_URL = "https://api.githubcopilot.com/mcp/";

/** Cap the whole MCP round-trip so a stalled subprocess/endpoint can't hang a forecast. */
const MCP_TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function gatherInternalHistoryViaMCP(
  repo: string,
  keywords: string[],
  githubToken: string,
): Promise<Evidence[]> {
  return process.env.GITHUB_MCP_MODE === "remote"
    ? gatherViaRemote(repo, keywords, githubToken)
    : gatherViaLocal(repo, keywords, githubToken);
}

// ── Local: our own MCP server over stdio (default) ────────────────────────────

async function gatherViaLocal(
  repo: string,
  keywords: string[],
  githubToken: string,
): Promise<Evidence[]> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", serverPath],
    env: { ...getDefaultEnvironment(), GITHUB_TOKEN: githubToken },
    stderr: "inherit",
  });
  const client = new Client({ name: "omen-grounding", version: "1.0.0" }, { capabilities: {} });

  try {
    await withTimeout(client.connect(transport), MCP_TIMEOUT_MS, "MCP connect");
    const result = await withTimeout(
      client.callTool({ name: "search_internal_history", arguments: { repo, keywords } }),
      MCP_TIMEOUT_MS,
      "MCP callTool",
    );
    return extractText(result);
  } finally {
    await client.close().catch(() => {});
  }
}

// ── Remote: GitHub's official MCP server over Streamable HTTP (opt-in) ─────────

async function gatherViaRemote(
  repo: string,
  keywords: string[],
  githubToken: string,
): Promise<Evidence[]> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) return [];

  const transport = new StreamableHTTPClientTransport(new URL(REMOTE_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${githubToken}` } },
  });
  const client = new Client({ name: "omen-grounding", version: "1.0.0" }, { capabilities: {} });

  try {
    await withTimeout(client.connect(transport), MCP_TIMEOUT_MS, "remote MCP connect");
    console.error("[omen/mcp] connected to GitHub official remote MCP server");

    // list_issues is deterministic (search_issues hits GitHub's flaky search-API
    // validation). We pull recent closed issues, then filter by launch keywords.
    const result = await withTimeout(
      client.callTool({
        name: "list_issues",
        arguments: { owner, repo: name, state: "CLOSED", perPage: 30 },
      }),
      MCP_TIMEOUT_MS,
      "remote MCP callTool",
    );
    return parseGitHubIssues(result, keywords);
  } finally {
    await client.close().catch(() => {});
  }
}

// ── Result parsing ────────────────────────────────────────────────────────────

/** Our own server returns a JSON array of Evidence in a text block. */
function extractText(result: unknown): Evidence[] {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = content.find((c) => c.type === "text")?.text;
  if (!text) return [];
  try {
    return JSON.parse(text) as Evidence[];
  } catch {
    return [];
  }
}

interface GHIssueLike {
  number?: number;
  title?: string;
  html_url?: string;
  url?: string;
  body?: string | null;
}

/**
 * Parses the official server's list_issues payload ({ issues: [...] } or a bare
 * array), filters by launch keywords, and maps to Evidence. Defensive: any shape
 * mismatch returns [] so grounding falls back to demo.
 */
function parseGitHubIssues(result: unknown, keywords: string[] = []): Evidence[] {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = content.find((c) => c.type === "text")?.text;
  if (!text) return [];

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const items: GHIssueLike[] =
    (data as { issues?: GHIssueLike[] }).issues ??
    (data as { items?: GHIssueLike[] }).items ??
    (Array.isArray(data) ? (data as GHIssueLike[]) : []);

  const kw = keywords.map((k) => k.toLowerCase());
  const matches = (it: GHIssueLike) => {
    if (!kw.length) return true;
    const hay = `${it.title ?? ""} ${it.body ?? ""}`.toLowerCase();
    return kw.some((k) => hay.includes(k));
  };

  // Prefer keyword-matching issues; fall back to most recent if none match.
  const filtered = items.filter(matches);
  return (filtered.length ? filtered : items)
    .slice(0, 6)
    .map((it) => ({
      source: "internal" as const,
      label: `#${it.number ?? "?"} ${it.title ?? "issue"}`.slice(0, 80),
      url: it.html_url ?? it.url,
      snippet: (it.body || it.title || "").replace(/\s+/g, " ").trim().slice(0, 140),
    }))
    .filter((e) => e.snippet.length > 0);
}
