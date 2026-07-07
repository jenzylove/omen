/** End-to-end check of the real remote-mode grounding path. */
import "dotenv/config";
import { gatherInternalHistoryViaMCP } from "./github-client.js";

if (!process.env.GITHUB_TOKEN) { console.log("No GITHUB_TOKEN — skipping."); process.exit(0); }
process.env.GITHUB_MCP_MODE = "remote";

const evidence = await gatherInternalHistoryViaMCP("facebook/react", ["bug", "memory", "hydration"], process.env.GITHUB_TOKEN!);
console.log(`✅ Remote MCP grounding returned ${evidence.length} evidence items:`);
for (const e of evidence.slice(0, 4)) console.log(`  • ${e.label} — ${e.snippet.slice(0, 70)}…`);
