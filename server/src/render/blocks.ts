/**
 * Block Kit rendering — turns a FailureForecast into the Slack surfaces Omen uses.
 * Kept structurally aligned with the web dashboard (same order, labels, tone):
 *   header → readiness → diff → grounding → drift → personas → failure modes → footer
 *
 * Surfaces:
 *   forecastBlocks()  — in-channel forecast message with interactive buttons
 *   appHomeBlocks()   — App Home tab: all active forecasts (mirrors "Launch Radar")
 *   forecastModal()   — full forecast in a modal (from App Home)
 */
import type { KnownBlock } from "@slack/types";
import type { FailureForecast, FailureMode, PersonaInsight, Provenance } from "../types.js";

const TAGLINE = "Every launch sends omens before it breaks.";

const PERSONA_META: Record<PersonaInsight["persona"], { icon: string; label: string }> = {
  saboteur: { icon: "💣", label: "Saboteur" },
  customer:  { icon: "😤", label: "Customer" },
  pessimist: { icon: "🌧️", label: "Pessimist" },
};

// ── Readiness helpers ────────────────────────────────────────────────────────

function readinessBadge(score: number): string {
  if (score >= 75) return `🟢 *${score}/100* — clear skies`;
  if (score >= 50) return `🟡 *${score}/100* — proceed with care`;
  if (score >= 25) return `🟠 *${score}/100* — high risk`;
  return `🔴 *${score}/100* — ship at your peril`;
}

/** ASCII progress bar: ████████░░  */
function readinessBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + `  ${score}%`;
}

function severityLabel(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 16) return "🔴 Critical";
  if (score >= 9)  return "🟠 High";
  if (score >= 4)  return "🟡 Medium";
  return "🟢 Low";
}

// ── Failure mode blocks (with interactive acknowledge button) ─────────────

function failureModeBlocks(
  mode: FailureMode,
  channelId: string,
  isAcknowledged: boolean,
): KnownBlock[] {
  const evidence = mode.evidence
    .map((e) => {
      const tag = e.source === "internal" ? "📁" : "🌐";
      const link = e.url ? `<${e.url}|${e.label}>` : `*${e.label}*`;
      return `${tag} ${link} — _${e.snippet}_`;
    })
    .join("\n");

  const header = isAcknowledged
    ? `~*${mode.title}*~  ✅ _mitigation accepted_`
    : `*${mode.title}*  ·  ${severityLabel(mode.likelihood, mode.impact)}  ·  L${mode.likelihood}×I${mode.impact}`;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: header },
      ...(isAcknowledged
        ? {}
        : {
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "✅ Accept mitigation", emoji: true },
              style: "primary",
              action_id: "omen_ack_mitigation",
              value: JSON.stringify({ channelId, failureModeId: mode.id }),
            },
          }),
    } as KnownBlock,
  ];

  if (!isAcknowledged) {
    blocks.push(
      {
        type: "section",
        text: { type: "mrkdwn", text: mode.narrative },
      } as KnownBlock,
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: evidence || "_no evidence cited_" }],
      } as KnownBlock,
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Mitigation:* ${mode.mitigation}${mode.owner ? `  ·  👤 ${mode.owner}` : ""}`,
        },
      } as KnownBlock,
    );
  }

  blocks.push({ type: "divider" } as KnownBlock);
  return blocks;
}

// ── Main forecast message ────────────────────────────────────────────────────

export function forecastBlocks(
  forecast: FailureForecast,
  acknowledged: Set<string> = new Set(),
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🔮 Omen  ·  ${forecast.launchName}`, emoji: true },
    } as KnownBlock,
    // Readiness — same labels/thresholds as the dashboard gauge.
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Launch Readiness*\n\`${readinessBar(forecast.readinessScore)}\`\n${readinessBadge(forecast.readinessScore)}`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "🔄 Re-run", emoji: true },
        action_id: "omen_rerun",
        value: JSON.stringify({ channelId: forecast.channelId, launchName: forecast.launchName }),
      },
    } as KnownBlock,
  ];

  // Re-run diff — only the reliable readiness delta (IDs churn across model runs).
  if (forecast.diff) {
    const { scoreDelta } = forecast.diff;
    const text =
      scoreDelta === 0
        ? "→ _Readiness unchanged since last run_"
        : scoreDelta > 0
          ? `🟢 ↑ _${scoreDelta} pts safer than last run_`
          : `🔴 ↓ _${Math.abs(scoreDelta)} pts riskier than last run_`;
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text }] } as KnownBlock);
  }

  // Grounding provenance (mirrors the dashboard's "Grounded in" chips, near the top).
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: groundingLine(forecast) }],
  } as KnownBlock);

  // Scope drift — with the drift → risk linkage (the signature insight).
  if (forecast.driftSignals.length) {
    const rankById = new Map(
      [...forecast.failureModes]
        .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
        .map((m, i) => [m.id, { n: i + 1, title: m.title }]),
    );
    const drift = forecast.driftSignals
      .map((d) => {
        const linked = d.linkedFailureId ? rankById.get(d.linkedFailureId) : undefined;
        const base = `• *${d.addition}*${d.addedBy ? ` _— added by ${d.addedBy}_` : ""}`;
        return linked ? `${base}  → _drives failure #${linked.n}: ${linked.title}_` : base;
      })
      .join("\n");
    blocks.push(
      { type: "divider" } as KnownBlock,
      {
        type: "section",
        text: { type: "mrkdwn", text: `⚠️ *Scope drift* — work added beyond the original spec:\n${drift}` },
      } as KnownBlock,
    );
  }

  // Adversarial perspectives.
  if (forecast.personaInsights?.length) {
    const personaText = forecast.personaInsights
      .map((p) => `${PERSONA_META[p.persona].icon} *${PERSONA_META[p.persona].label}:* ${p.take}`)
      .join("\n\n");
    blocks.push(
      { type: "divider" } as KnownBlock,
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Adversarial perspectives*\n\n${personaText}` },
      } as KnownBlock,
    );
  }

  // Failure modes.
  blocks.push(
    { type: "divider" } as KnownBlock,
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Predicted failure modes* — ${forecast.failureModes.length}, ranked by severity:`,
      },
    } as KnownBlock,
  );

  const ranked = [...forecast.failureModes].sort(
    (a, b) => b.likelihood * b.impact - a.likelihood * a.impact,
  );
  for (const mode of ranked) {
    blocks.push(...failureModeBlocks(mode, forecast.channelId, acknowledged.has(mode.id)));
  }

  // Footer — matches the dashboard's footer line.
  const ackCount = acknowledged.size;
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: [
          `_${TAGLINE}_`,
          ackCount > 0 ? `${ackCount}/${forecast.failureModes.length} mitigations accepted` : "",
          `Generated ${new Date(forecast.generatedAt).toLocaleString()}`,
        ]
          .filter(Boolean)
          .join("  ·  "),
      },
    ],
  } as KnownBlock);

  return blocks;
}

/** Grounding line with live/demo tags + per-leg counts — mirrors the web ProvenanceChips. */
function groundingLine(forecast: FailureForecast): string {
  const p = forecast.provenance;
  // Prefer the real leg counts; fall back to citation counts for older/seed forecasts.
  const gc = forecast.groundingCounts;
  const evidence = forecast.failureModes.flatMap((m) => m.evidence);
  const internal = gc ? gc.internalHistory : evidence.filter((e) => e.source === "internal").length;
  const external = gc ? gc.externalComparables : evidence.filter((e) => e.source === "external").length;
  const tag = (s: Provenance["conversation"]) => (s === "live" ? "✅ live" : "🧪 demo");
  return [
    "*Grounded in:*",
    `Slack ${tag(p.conversation)}`,
    `GitHub/MCP · ${internal} incidents ${tag(p.internalHistory)}`,
    `Search · ${external} comparables ${tag(p.externalComparables)}`,
  ].join("   ·   ");
}

// ── App Home view ─────────────────────────────────────────────────────────────

export function appHomeBlocks(forecasts: FailureForecast[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔮 Omen — Launch Radar", emoji: true },
    } as KnownBlock,
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `_${TAGLINE}_\nType \`/omen [launch name]\` in any project channel to get a grounded failure forecast.`,
      },
    } as KnownBlock,
    { type: "divider" } as KnownBlock,
  ];

  if (!forecasts.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "No forecasts yet. Run `/omen` in a project channel to get started." },
    } as KnownBlock);
    return blocks;
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Active forecasts — ${forecasts.length} launch${forecasts.length === 1 ? "" : "es"} on radar:*` },
  } as KnownBlock);

  for (const f of forecasts) {
    const criticalCount = f.failureModes.filter((m) => m.likelihood * m.impact >= 16).length;
    const age = Math.round((Date.now() - new Date(f.generatedAt).getTime()) / 60000);
    const ageLabel = age < 1 ? "just now" : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
    const demo = isDemo(f) ? "  ·  🧪 demo" : "";

    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*${f.launchName}*`,
            `\`${readinessBar(f.readinessScore)}\``,
            `${readinessBadge(f.readinessScore)}${criticalCount > 0 ? `  ·  🔴 ${criticalCount} critical` : ""}`,
          ].join("\n"),
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View forecast", emoji: true },
          action_id: "omen_view_forecast",
          value: f.channelId,
        },
      } as KnownBlock,
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Updated ${ageLabel}  ·  ${f.failureModes.length} failure modes  ·  ${f.driftSignals.length} drift signals${demo}` }],
      } as KnownBlock,
      { type: "divider" } as KnownBlock,
    );
  }

  return blocks;
}

function isDemo(f: FailureForecast): boolean {
  const p = f.provenance;
  return p.conversation === "demo" || p.internalHistory === "demo" || p.externalComparables === "demo";
}

// ── Modal: full forecast view (triggered from App Home button) ──────────────

export function forecastModal(forecast: FailureForecast, acknowledged: Set<string>): Record<string, unknown> {
  return {
    type: "modal",
    title: { type: "plain_text", text: "🔮 Omen Forecast", emoji: true },
    close: { type: "plain_text", text: "Close" },
    blocks: forecastBlocks(forecast, acknowledged),
  };
}
