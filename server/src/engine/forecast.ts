/**
 * Forecast synthesis — turns grounding context into a ranked, cited failure forecast.
 *
 * Uses Claude with tool-use to force structured output in one round-trip.
 * The tool schema includes persona insights so we get Saboteur / Customer /
 * Pessimist takes without a second API call.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { FailureForecast, FailureMode, GroundingContext, PersonaInsight } from "../types.js";

const SYSTEM_PROMPT = `You are Omen, a pre-mortem agent. Given the real context of an upcoming launch, predict the specific ways it will FAIL — before it ships.

Rules:
- Be adversarial and concrete. Describe HOW each failure unfolds as a short narrative, not "consider X".
- Ground every failure mode in the provided evidence. Never invent evidence; only cite what you were given.
- Prefer failures implied by SCOPE DRIFT — work that crept in beyond the original spec is the likeliest break point. For each drift signal, set linkedFailureId to the id of the failure mode that drift most directly causes (this connection is the whole point).
- Rank by likelihood (1-5) and impact (1-5). Give each a single concrete mitigation and, if inferable, an owner.
- Return 3-5 failure modes. Quality over quantity.

Also provide three adversarial persona insights — short (2-3 sentence) takes on the overall forecast:
- saboteur: "If I were trying to make this fail, my attack vector is..." — technical worst-case
- customer: "From a user's perspective, here's what breaks for me..." — trust/UX impact
- pessimist: "Here's what everyone is pretending not to see..." — org/process dysfunction`;

const FORECAST_TOOL: Anthropic.Tool = {
  name: "emit_forecast",
  description: "Emit the structured failure forecast including persona insights.",
  input_schema: {
    type: "object",
    properties: {
      failureModes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            likelihood: { type: "number", description: "1-5" },
            impact: { type: "number", description: "1-5" },
            narrative: { type: "string", description: "How this failure unfolds, specific to this launch." },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string", enum: ["internal", "external"] },
                  label: { type: "string" },
                  url: { type: "string" },
                  snippet: { type: "string" },
                },
                required: ["source", "label", "snippet"],
              },
            },
            mitigation: { type: "string" },
            owner: { type: "string" },
          },
          required: ["id", "title", "likelihood", "impact", "narrative", "evidence", "mitigation"],
        },
      },
      driftSignals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            addition: { type: "string" },
            addedBy: { type: "string" },
            when: { type: "string" },
            linkedFailureId: {
              type: "string",
              description: "id of the failure mode this scope drift most directly causes",
            },
          },
          required: ["addition"],
        },
      },
      personaInsights: {
        type: "array",
        description: "Three adversarial takes — one per persona.",
        items: {
          type: "object",
          properties: {
            persona: { type: "string", enum: ["saboteur", "customer", "pessimist"] },
            take: { type: "string", description: "2-3 sentences. Specific to this launch." },
          },
          required: ["persona", "take"],
        },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ["failureModes", "driftSignals", "personaInsights"],
  },
};

export function computeReadinessScore(modes: FailureMode[]): number {
  // Each risk point (likelihood × impact, 1–25 per mode) costs one readiness point.
  // A typical 3–5 mode forecast lands across the range (e.g. two criticals + two
  // lesser risks ≈ 43) instead of flooring at 0, so the gauge — and the re-run
  // score diff — actually carry signal. Only an overwhelming forecast hits 0.
  const risk = modes.reduce((sum, m) => sum + m.likelihood * m.impact, 0);
  return Math.max(0, 100 - Math.min(100, risk));
}

export interface ForecastOptions {
  apiKey: string;
  model?: string;
}

export async function synthesizeForecast(
  ctx: GroundingContext,
  opts: ForecastOptions,
): Promise<FailureForecast> {
  // Bound the call so a stalled request can't hang a forecast for the SDK's
  // 10-minute default — on a re-run the prompt is larger and free-tier hosts
  // are memory-tight, which is exactly when a request can hang.
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 70_000, maxRetries: 1 });

  const userContent = [
    `Launch: ${ctx.launchName}`,
    ctx.specBaseline ? `Original spec (baseline): ${ctx.specBaseline}` : "",
    "",
    "Recent conversation:",
    ...ctx.conversation.map((m) => `  @${m.user}: ${m.text}`),
    "",
    "Internal history (via GitHub/MCP):",
    ...ctx.internalHistory.map((e) => `  [${e.label}] ${e.snippet}${e.url ? ` (${e.url})` : ""}`),
    "",
    "External comparable failures (via real-time search):",
    ...ctx.externalComparables.map((e) => `  [${e.label}] ${e.snippet}${e.url ? ` (${e.url})` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: opts.model ?? "claude-opus-4-8",
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    tools: [FORECAST_TOOL],
    tool_choice: { type: "tool", name: "emit_forecast" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Omen: model did not return a forecast.");

  const out = toolUse.input as Pick<FailureForecast, "failureModes" | "driftSignals" | "personaInsights">;

  return {
    launchName: ctx.launchName,
    channelId: ctx.channelId,
    readinessScore: computeReadinessScore(out.failureModes),
    failureModes: out.failureModes,
    driftSignals: out.driftSignals ?? [],
    personaInsights: out.personaInsights ?? [],
    provenance: ctx.provenance,
    groundingCounts: {
      internalHistory: ctx.internalHistory.length,
      externalComparables: ctx.externalComparables.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
