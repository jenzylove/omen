import type { ForecastDiff } from "../types";

interface Props {
  diff: ForecastDiff;
  compact?: boolean;
}

/**
 * Shows the change in readiness since the previous run.
 * We intentionally show only `scoreDelta` — the readiness score is computed
 * deterministically from severity, so it's a reliable signal. New/resolved
 * failure-mode IDs are NOT shown because the model regenerates IDs each run,
 * which would make every re-run look like a total churn.
 */
export function DiffBadge({ diff, compact = false }: Props) {
  const { scoreDelta } = diff;
  const improved = scoreDelta > 0;
  const unchanged = scoreDelta === 0;

  const color = unchanged ? "text-slate-400" : improved ? "text-green-400" : "text-red-400";
  const arrow = unchanged ? "→" : improved ? "↑" : "↓";

  if (compact) {
    return (
      <span className={`text-xs font-mono font-bold ${color}`}>
        {unchanged ? "—" : `${arrow}${Math.abs(scoreDelta)}`}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono ${color}`}>
      <span className="text-sm">{arrow}</span>
      {unchanged ? "Readiness unchanged since last run" : `${Math.abs(scoreDelta)} pts ${improved ? "safer" : "riskier"} than last run`}
    </span>
  );
}
