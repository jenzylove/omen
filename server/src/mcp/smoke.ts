/** Smoke test: connect to the GitHub MCP server and list/call tools. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./github-server.ts", import.meta.url));

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", serverPath],
  env: { ...getDefaultEnvironment(), GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "" },
  stderr: "inherit",
});

const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools exposed by MCP server:", tools.tools.map((t) => t.name));

const result = await client.callTool({
  name: "search_internal_history",
  arguments: { repo: "acme/payments", keywords: ["payments", "processor"] },
});
console.log("callTool result:", JSON.stringify(result.content));

await client.close();
console.log("✅ MCP round-trip OK");
