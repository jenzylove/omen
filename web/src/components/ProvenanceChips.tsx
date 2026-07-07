import type { Provenance } from "../types";

interface Props {
  provenance: Provenance;
  counts: { internal: number; external: number };
}

function Chip({ label, source }: { label: string; source: "live" | "demo" }) {
  const live = source === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
        live
          ? "bg-green-950/40 text-green-300 border-green-500/40"
          : "bg-slate-800 text-slate-400 border-slate-600/60"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-green-400" : "bg-slate-500"}`} />
      {label}
      <span className="opacity-70">{live ? "live" : "demo"}</span>
    </span>
  );
}

export function ProvenanceChips({ provenance, counts }: Props) {
  const anyDemo =
    provenance.conversation === "demo" ||
    provenance.internalHistory === "demo" ||
    provenance.externalComparables === "demo";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Grounded in:</span>
        <Chip label="Slack channel" source={provenance.conversation} />
        <Chip label={`GitHub/MCP · ${counts.internal} incidents`} source={provenance.internalHistory} />
        <Chip label={`Search · ${counts.external} comparables`} source={provenance.externalComparables} />
      </div>
      {anyDemo && (
        <p className="text-xs text-slate-500">
          🧪 Some legs show <span className="text-slate-400">demo</span> — connect Slack, GitHub, or a
          Tavily key in <code className="font-mono">.env</code> to make them live.
        </p>
      )}
    </div>
  );
}
