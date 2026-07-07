/**
 * Omen GitHub MCP server.
 *
 * A real Model Context Protocol server (stdio transport) that exposes the org's
 * GitHub history as an MCP tool. The grounding engine connects to this as an MCP
 * *client* and calls `search_internal_history` over the protocol — so GitHub
 * grounding genuinely flows through MCP, not a direct REST call from the engine.
 *
 * The tool handler uses the GitHub REST API as its data source, which is exactly
 * what an MCP server does: wrap an external system behind the protocol.
 *
 * Run standalone for debugging:  node --import tsx src/mcp/github-server.ts
 * Normally it's spawned by github-client.ts.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { gatherInternalHistory } from "../engine/github-reader.js";

const server = new Server(
  { name: "omen-github", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_internal_history",
      description:
        "Search a GitHub repository for past incidents, postmortems, and risky merged PRs relevant to an upcoming launch. Returns grounded evidence the pre-mortem can cite.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "owner/repo, e.g. acme-org/payments" },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Terms pulled from the launch conversation to narrow the search",
          },
        },
        required: ["repo", "keywords"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "search_internal_history") {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const args = (req.params.arguments ?? {}) as { repo?: string; keywords?: string[] };
  const repo = args.repo ?? "";
  const keywords = args.keywords ?? [];
  const token = process.env.GITHUB_TOKEN ?? "";

  if (!repo || !token) {
    return { content: [{ type: "text", text: "[]" }] };
  }

  const evidence = await gatherInternalHistory({ token, repo, keywords });
  return { content: [{ type: "text", text: JSON.stringify(evidence) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is the MCP channel and must stay clean.
console.error("[omen/mcp] github-server connected over stdio");
