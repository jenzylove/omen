import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FailureForecast } from "./types";
import { subscribeToForecasts, runForecast } from "./api";
import { ReadinessGauge } from "./components/ReadinessGauge";
import { ForecastDetail } from "./components/ForecastDetail";
import { DiffBadge } from "./components/DiffBadge";
import { Logo } from "./components/Logo";
import { Spinner } from "./components/Spinner";
import { ForecastProgress } from "./components/ForecastProgress";

function readinessBarColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function isDemo(f: FailureForecast): boolean {
  const p = f.provenance;
  return p.conversation === "demo" || p.internalHistory === "demo" || p.externalComparables === "demo";
}

export default function App() {
  const navigate = useNavigate();
  const [forecasts, setForecasts] = useState<FailureForecast[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function upsert(forecast: FailureForecast) {
    setForecasts((prev) => [forecast, ...prev.filter((f) => f.channelId !== forecast.channelId)]);
  }

  useEffect(() => {
    const unsub = subscribeToForecasts(
      (all) => { setForecasts(all); setLive(true); },
      (forecast) => {
        upsert(forecast);
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      },
    );
    return unsub;
  }, []);

  const activeForecast = selected ? forecasts.find((f) => f.channelId === selected) : null;

  async function handleRerun(f: FailureForecast) {
    const updated = await runForecast(f.launchName, f.channelId);
    upsert(updated);
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-40"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.25), transparent 70%)" }}
      />

      {/* Nav */}
      <nav className="relative border-b border-slate-800/80 backdrop-blur px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Logo size={26} />
          <span className="font-bold text-lg tracking-tight">Omen</span>
        </button>
        <span className="text-slate-500 text-sm hidden md:block border-l border-slate-800 pl-3">
          Every launch sends omens before it breaks
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                live ? (pulse ? "bg-green-300 scale-125" : "bg-green-500") : "bg-slate-600"
              }`}
            />
            <span className="text-xs text-slate-400">{live ? "Live" : "Connecting…"}</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-lg shadow-violet-900/30"
          >
            + New forecast
          </button>
        </div>
      </nav>

      <main className="relative px-6 py-10">
        {activeForecast ? (
          <ForecastDetail
            forecast={activeForecast}
            onBack={() => setSelected(null)}
            onRerun={() => handleRerun(activeForecast)}
          />
        ) : (
          <div className="max-w-3xl mx-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Launch Radar</h1>
              <p className="text-slate-400 mt-2">
                {forecasts.length === 0
                  ? "No forecasts yet — start one below, or run /omen in Slack."
                  : `${forecasts.length} launch${forecasts.length === 1 ? "" : "es"} on radar, ranked by risk.`}
              </p>
            </header>

            {forecasts.length === 0 ? (
              <EmptyState onNew={() => setShowForm(true)} />
            ) : (
              <div className="space-y-4">
                {forecasts.map((f) => (
                  <ForecastCard
                    key={f.channelId}
                    forecast={f}
                    onClick={() => setSelected(f.channelId)}
                    barColor={readinessBarColor(f.readinessScore)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showForm && (
        <NewForecastModal
          onClose={() => setShowForm(false)}
          onCreated={(f) => {
            upsert(f);
            setSelected(f.channelId);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function ForecastCard({
  forecast: f,
  onClick,
  barColor,
}: {
  forecast: FailureForecast;
  onClick: () => void;
  barColor: string;
}) {
  const age = Math.round((Date.now() - new Date(f.generatedAt).getTime()) / 60000);
  const ageLabel = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
  const critical = f.failureModes.filter((m) => m.likelihood * m.impact >= 16).length;
  const ranked = [...f.failureModes].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all group"
    >
      <div className="flex items-center gap-6">
        <div className="w-28 flex-shrink-0 flex flex-col items-center">
          <ReadinessGauge score={f.readinessScore} size={96} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-bold text-white text-lg truncate group-hover:text-violet-300 transition-colors">
              {f.launchName}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {isDemo(f) && (
                <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                  demo
                </span>
              )}
              <span className="text-xs text-slate-500">{ageLabel}</span>
            </div>
          </div>

          <div className="h-2 bg-slate-800 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${f.readinessScore}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
            <span>{f.failureModes.length} failure modes</span>
            {critical > 0 && <span className="text-red-400 font-medium">🔴 {critical} critical</span>}
            {f.driftSignals.length > 0 && (
              <span className="text-yellow-500">⚠️ {f.driftSignals.length} drift signals</span>
            )}
          </div>

          {f.diff && <DiffBadge diff={f.diff} />}
          {ranked[0] && !f.diff && (
            <p className="text-xs text-slate-500 truncate">
              Top risk: <span className="text-slate-400">{ranked[0].title}</span>
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-violet-400 transition-colors">
            View full forecast
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>

        {/* Chevron affordance — makes the whole card obviously clickable */}
        <div className="self-center shrink-0 text-2xl text-slate-700 group-hover:text-violet-400 transition-colors">
          ›
        </div>
      </div>
    </button>
  );
}

function NewForecastModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (f: FailureForecast) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const f = await runForecast(name.trim());
      onCreated(f);
    } catch {
      setError("Forecast failed — check the server is running.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-32 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Logo size={22} />
          <h2 className="font-bold text-lg">{busy ? "Reading the omens…" : "New forecast"}</h2>
        </div>

        {busy ? (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Forecasting <span className="text-white font-medium">{name.trim()}</span>
            </p>
            <ForecastProgress />
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Name the launch you're about to ship. Omen will forecast how it fails.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Payments v2 launch"
              className="w-full bg-slate-950 border border-slate-700 focus:border-violet-500 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm text-slate-400 hover:text-white px-3 py-2 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {busy && <Spinner />}
            {busy ? "Working…" : "Forecast"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
      <div className="flex justify-center mb-4">
        <Logo size={56} />
      </div>
      <h2 className="text-slate-200 font-semibold mb-2 text-lg">No launches on radar</h2>
      <p className="text-slate-500 text-sm max-w-sm mx-auto mb-5">
        Start a forecast here, or type{" "}
        <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-400 font-mono">/omen [launch]</code>{" "}
        in any Slack project channel.
      </p>
      <button
        onClick={onNew}
        className="text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors"
      >
        + New forecast
      </button>
    </div>
  );
}
