import { useState } from "react";
import type { FailureForecast, FailureMode } from "../types";
import { ReadinessGauge } from "./ReadinessGauge";
import { FailureModeCard } from "./FailureModeCard";
import { PersonaPanel } from "./PersonaPanel";
import { DiffBadge } from "./DiffBadge";
import { ProvenanceChips } from "./ProvenanceChips";
import { Spinner } from "./Spinner";

function readinessLabel(score: number): string {
  if (score >= 75) return "Clear skies";
  if (score >= 50) return "Proceed with care";
  if (score >= 25) return "High risk";
  return "Ship at your peril";
}

function severityLabel(score: number): string {
  if (score >= 16) return "CRITICAL";
  if (score >= 9)  return "HIGH";
  if (score >= 4)  return "MEDIUM";
  return "LOW";
}

function modeToMarkdown(mode: FailureMode, index: number, driftCauses: string[]): string {
  const sev = severityLabel(mode.likelihood * mode.impact);
  const lines: string[] = [];
  lines.push(`### #${index + 1} — ${mode.title}`);
  lines.push(`**Severity:** ${sev} · L${mode.likelihood}×I${mode.impact}`);
  if (driftCauses.length > 0) {
    lines.push(`**Caused by scope drift:** ${driftCauses.join(", ")}`);
  }
  lines.push("");
  lines.push(mode.narrative);
  if (mode.evidence.length > 0) {
    lines.push("");
    lines.push("**Evidence:**");
    for (const e of mode.evidence) {
      const icon = e.source === "internal" ? "📁" : "🌐";
      const ref = e.url ? `[${e.label}](${e.url})` : e.label;
      lines.push(`- ${icon} ${ref} — ${e.snippet}`);
    }
  }
  lines.push("");
  const ownerSuffix = mode.owner ? ` · 👤 ${mode.owner}` : "";
  lines.push(`**Mitigation:** ${mode.mitigation}${ownerSuffix}`);
  return lines.join("\n");
}

function forecastToMarkdown(forecast: FailureForecast): string {
  const ranked = [...forecast.failureModes].sort(
    (a, b) => b.likelihood * b.impact - a.likelihood * a.impact,
  );
  const rankById = new Map(ranked.map((m, i) => [m.id, { n: i + 1, title: m.title }]));
  const driftByFailure = new Map<string, string[]>();
  for (const d of forecast.driftSignals) {
    if (!d.linkedFailureId) continue;
    const list = driftByFailure.get(d.linkedFailureId) ?? [];
    list.push(d.addition);
    driftByFailure.set(d.linkedFailureId, list);
  }

  const p = forecast.provenance;
  const provLine = [
    `Slack (${p.conversation})`,
    `GitHub/MCP (${p.internalHistory})`,
    `Search (${p.externalComparables})`,
  ].join(" · ");

  const sections: string[] = [];

  sections.push(`# Omen Forecast: ${forecast.launchName}`);
  sections.push(
    `**Readiness Score:** ${forecast.readinessScore}/100 — ${readinessLabel(forecast.readinessScore)}`,
  );
  sections.push(`**Generated:** ${new Date(forecast.generatedAt).toLocaleString()}`);
  sections.push(`**Grounding:** ${provLine}`);

  if (forecast.driftSignals.length > 0) {
    sections.push("---");
    sections.push("## ⚠️ Scope Drift");
    for (const d of forecast.driftSignals) {
      const linked = d.linkedFailureId ? rankById.get(d.linkedFailureId) : undefined;
      const by = d.addedBy ? ` — added by ${d.addedBy}` : "";
      const arrow = linked ? ` → drives failure #${linked.n}: ${linked.title}` : "";
      sections.push(`- **${d.addition}**${by}${arrow}`);
    }
  }

  sections.push("---");
  sections.push("## Failure Modes (ranked by severity)");
  sections.push("");
  for (const [i, mode] of ranked.entries()) {
    sections.push(modeToMarkdown(mode, i, driftByFailure.get(mode.id) ?? []));
    sections.push("");
  }

  if (forecast.personaInsights.length > 0) {
    const icons: Record<string, string> = { saboteur: "💣", customer: "😤", pessimist: "🌧️" };
    const labels: Record<string, string> = { saboteur: "Saboteur", customer: "Customer", pessimist: "Pessimist" };
    sections.push("---");
    sections.push("## Adversarial Perspectives");
    sections.push("");
    for (const p of forecast.personaInsights) {
      sections.push(`### ${icons[p.persona] ?? ""} ${labels[p.persona] ?? p.persona}`);
      sections.push(p.take);
      sections.push("");
    }
  }

  sections.push("---");
  sections.push("*Omen — adversarial pre-mortem · grounded in your own history + real-time comparables*");

  return sections.join("\n\n");
}

interface Props {
  forecast: FailureForecast;
  onBack: () => void;
  onRerun: () => Promise<void>;
}

export function ForecastDetail({ forecast, onBack, onRerun }: Props) {
  const [rerunning, setRerunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(forecastToMarkdown(forecast));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a textarea
      const el = document.createElement("textarea");
      el.value = forecastToMarkdown(forecast);
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const ranked = [...forecast.failureModes].sort(
    (a, b) => b.likelihood * b.impact - a.likelihood * a.impact,
  );
  const age = Math.round((Date.now() - new Date(forecast.generatedAt).getTime()) / 60000);
  const ageLabel = age < 1 ? "just now" : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
  const critical = ranked.filter((m) => m.likelihood * m.impact >= 16).length;

  const allEvidence = forecast.failureModes.flatMap((m) => m.evidence);
  const counts = {
    internal: allEvidence.filter((e) => e.source === "internal").length,
    external: allEvidence.filter((e) => e.source === "external").length,
  };

  // Drift → risk linkage: map each failure mode to its rank (#N) + title, and
  // gather the scope-drift additions the model linked to each failure mode.
  const rankById = new Map(ranked.map((m, i) => [m.id, { n: i + 1, title: m.title }]));
  const driftByFailure = new Map<string, string[]>();
  for (const d of forecast.driftSignals) {
    if (!d.linkedFailureId) continue;
    const list = driftByFailure.get(d.linkedFailureId) ?? [];
    list.push(d.addition);
    driftByFailure.set(d.linkedFailureId, list);
  }

  async function rerun() {
    if (rerunning) return;
    setRerunning(true);
    try {
      await onRerun();
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <h2 className="text-white font-bold text-xl flex-1 min-w-0 truncate">{forecast.launchName}</h2>
        <span className="text-xs text-slate-500 shrink-0 hidden sm:block">Updated {ageLabel}</span>
        <button
          onClick={rerun}
          disabled={rerunning}
          className="shrink-0 text-sm font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-60 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
        >
          {rerunning ? <Spinner /> : "🔄"}
          {rerunning ? "Re-running…" : "Re-run"}
        </button>
      </div>

      {/* Diff banner */}
      {forecast.diff && (
        <div className="mb-5 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/40">
          <DiffBadge diff={forecast.diff} />
        </div>
      )}

      {/* Grounding provenance */}
      <div className="mb-6">
        <ProvenanceChips provenance={forecast.provenance} counts={counts} />
      </div>

      {/* Readiness + stats */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center gap-8">
        <ReadinessGauge score={forecast.readinessScore} size={150} />
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-5 w-full">
          <Stat label="Failure modes" value={String(ranked.length)} />
          <Stat label="Critical" value={String(critical)} highlight={critical > 0} />
          <Stat label="Scope drift" value={String(forecast.driftSignals.length)} />
          <Stat
            label="Top severity"
            value={ranked[0] ? `L${ranked[0].likelihood}×I${ranked[0].impact}` : "—"}
          />
        </div>
      </div>

      {/* Persona panel */}
      {forecast.personaInsights.length > 0 && (
        <div className="mb-8">
          <h3 className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-3">
            Adversarial perspectives
          </h3>
          <PersonaPanel insights={forecast.personaInsights} />
        </div>
      )}

      {/* Drift signals */}
      {forecast.driftSignals.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-600/40 rounded-2xl p-5 mb-8">
          <h3 className="text-yellow-400 font-semibold text-sm mb-2">
            ⚠️ Scope drift — work added beyond original spec
          </h3>
          <ul className="space-y-1">
            {forecast.driftSignals.map((d, i) => {
              const linked = d.linkedFailureId ? rankById.get(d.linkedFailureId) : undefined;
              return (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-yellow-600 shrink-0">•</span>
                  <span>
                    <span className="font-medium">{d.addition}</span>
                    {d.addedBy && <span className="text-slate-500 ml-1">— added by {d.addedBy}</span>}
                    {linked && (
                      <span className="ml-1 text-red-400">
                        {" "}→ drives failure #{linked.n}: <span className="text-red-300">{linked.title}</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Failure modes */}
      <h3 className="text-slate-300 font-semibold text-sm mb-4">
        Predicted failure modes — ranked by severity
      </h3>
      <div className="space-y-4">
        {ranked.map((mode, i) => (
          <FailureModeCard key={mode.id} mode={mode} index={i} driftCauses={driftByFailure.get(mode.id)} />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={copyMarkdown}
          className="text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          {copied ? "✓ Copied to clipboard" : "📋 Copy forecast as markdown"}
        </button>
      </div>

      <p className="text-xs text-slate-600 text-center mt-4">
        Adversarial pre-mortem · grounded in your own history + real-time comparables
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div
        className={`text-2xl font-bold font-mono ${highlight ? "text-red-400" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}
