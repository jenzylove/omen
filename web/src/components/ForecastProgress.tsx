import { useEffect, useState } from "react";

/**
 * Staged progress shown while a forecast runs (~30-45s). The request is a single
 * call with no server-sent progress, so we advance through the real pipeline
 * stages on a timer — turning dead wait-time into a visible showcase of the
 * three technologies actually doing work. The final "Synthesizing" stage holds
 * until the response arrives.
 */
const STAGES = [
  { icon: "💬", label: "Reading the Slack channel", tech: "Slack" },
  { icon: "📁", label: "Querying your GitHub history", tech: "MCP" },
  { icon: "🌐", label: "Searching comparable failures", tech: "real-time search" },
  { icon: "🔮", label: "Synthesizing the forecast", tech: "Claude" },
] as const;

// Rough pacing so the bar reaches the last stage around ~24s, then holds.
const STEP_MS = 8000;

export function ForecastProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2.5">
      {STAGES.map((s, i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <div
            key={s.label}
            className={`flex items-center gap-3 text-sm transition-opacity ${
              i > stage ? "opacity-35" : "opacity-100"
            }`}
          >
            <span className="w-5 text-center">
              {done ? (
                <span className="text-green-400">✓</span>
              ) : active ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin align-middle" />
              ) : (
                <span className="text-slate-600">{s.icon}</span>
              )}
            </span>
            <span className={done ? "text-slate-400" : active ? "text-white" : "text-slate-500"}>
              {s.label}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
              {s.tech}
            </span>
          </div>
        );
      })}
    </div>
  );
}
