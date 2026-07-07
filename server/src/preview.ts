/**
 * Local preview — renders a forecast to the console without Slack creds.
 * Run: npm run preview
 */
import "dotenv/config";
import { generateForecast } from "./engine/index.js";
import { forecastBlocks } from "./render/blocks.js";

const forecast = await generateForecast("C0DEMO", "Payments v2 launch", {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.OMEN_MODEL,
});

console.log(`\n🔮 Omen — ${forecast.launchName}`);
console.log(`Readiness: ${forecast.readinessScore}/100`);

if (forecast.driftSignals.length) {
  console.log(`\n⚠️  Scope drift (${forecast.driftSignals.length}):`);
  for (const d of forecast.driftSignals) {
    console.log(`   • ${d.addition}${d.addedBy ? ` (${d.addedBy})` : ""}`);
  }
}

console.log(`\nFailure modes (${forecast.failureModes.length}):`);
for (const m of forecast.failureModes) {
  console.log(`\n• [L${m.likelihood}×I${m.impact}] ${m.title}`);
  console.log(`  ${m.narrative}`);
  console.log(`  ✅ ${m.mitigation}`);
}

if (forecast.personaInsights?.length) {
  console.log(`\nAdversarial perspectives:`);
  for (const p of forecast.personaInsights) {
    const icon = p.persona === "saboteur" ? "💣" : p.persona === "customer" ? "😤" : "🌧️";
    console.log(`\n  ${icon} ${p.persona.toUpperCase()}: ${p.take}`);
  }
}

console.log(`\nBlock Kit payload: ${forecastBlocks(forecast).length} blocks ready for Slack.\n`);
