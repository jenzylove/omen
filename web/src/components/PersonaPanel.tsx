import { useState } from "react";
import type { PersonaInsight, PersonaName } from "../types";

interface Props {
  insights: PersonaInsight[];
}

const PERSONA_META: Record<PersonaName, { label: string; icon: string; color: string; border: string; bg: string }> = {
  saboteur: {
    label: "Saboteur",
    icon: "💣",
    color: "text-red-400",
    border: "border-red-500/40",
    bg: "bg-red-950/30",
  },
  customer: {
    label: "Customer",
    icon: "😤",
    color: "text-blue-400",
    border: "border-blue-500/40",
    bg: "bg-blue-950/30",
  },
  pessimist: {
    label: "Pessimist",
    icon: "🌧️",
    color: "text-purple-400",
    border: "border-purple-500/40",
    bg: "bg-purple-950/30",
  },
};

export function PersonaPanel({ insights }: Props) {
  const [active, setActive] = useState<PersonaName>("saboteur");

  const ordered: PersonaName[] = ["saboteur", "customer", "pessimist"];
  const current = insights.find((i) => i.persona === active);

  if (!insights.length) return null;

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-700 bg-slate-900/60">
        {ordered.map((p) => {
          const meta = PERSONA_META[p];
          const isActive = p === active;
          return (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? `${meta.color} border-b-2 ${meta.border} bg-slate-800/60`
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {current && (
        <div className={`p-4 ${PERSONA_META[current.persona].bg}`}>
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{current.take}"
          </p>
        </div>
      )}
    </div>
  );
}
