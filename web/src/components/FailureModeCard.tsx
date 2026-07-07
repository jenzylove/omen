import type { FailureMode } from "../types";

interface Props {
  mode: FailureMode;
  index: number;
  /** Scope-drift additions that the model linked to this failure mode. */
  driftCauses?: string[];
}

function severityColor(score: number): string {
  if (score >= 16) return "border-red-500 bg-red-950/30";
  if (score >= 9)  return "border-orange-500 bg-orange-950/30";
  if (score >= 4)  return "border-yellow-500 bg-yellow-950/30";
  return "border-green-600 bg-green-950/20";
}

function severityLabel(score: number): { text: string; cls: string } {
  if (score >= 16) return { text: "CRITICAL", cls: "bg-red-500/20 text-red-400 border border-red-500/40" };
  if (score >= 9)  return { text: "HIGH",     cls: "bg-orange-500/20 text-orange-400 border border-orange-500/40" };
  if (score >= 4)  return { text: "MEDIUM",   cls: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" };
  return              { text: "LOW",      cls: "bg-green-500/20 text-green-400 border border-green-500/40" };
}

export function FailureModeCard({ mode, index, driftCauses = [] }: Props) {
  const score = mode.likelihood * mode.impact;
  const sev = severityLabel(score);

  return (
    <div className={`rounded-lg border-l-4 p-4 ${severityColor(score)}`}>
      {driftCauses.length > 0 && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
          <span>⚠️ Caused by scope drift:</span>
          <span className="text-yellow-200">{driftCauses.join(", ")}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-slate-500 text-sm font-mono shrink-0">#{index + 1}</span>
          <h3 className="text-white font-semibold text-sm leading-snug">{mode.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.cls}`}>
            {sev.text}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            L{mode.likelihood}×I{mode.impact}
          </span>
        </div>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed mb-3">{mode.narrative}</p>

      {/* Evidence */}
      {mode.evidence.length > 0 && (
        <div className="mb-3 space-y-1">
          {mode.evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="shrink-0">{e.source === "internal" ? "📁" : "🌐"}</span>
              <span>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 mr-1">
                    {e.label}
                  </a>
                ) : (
                  <span className="text-slate-300 mr-1">{e.label}</span>
                )}
                — {e.snippet}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mitigation */}
      <div className="flex items-start gap-2 bg-slate-800/60 rounded px-3 py-2 text-sm">
        <span className="shrink-0">✅</span>
        <span className="text-slate-200">{mode.mitigation}</span>
        {mode.owner && (
          <span className="ml-auto shrink-0 text-xs text-slate-400">👤 {mode.owner}</span>
        )}
      </div>
    </div>
  );
}
