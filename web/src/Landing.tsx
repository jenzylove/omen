import { useNavigate } from "react-router-dom";
import { Logo } from "./components/Logo";

const STEPS = [
  {
    icon: "💬",
    step: "01",
    title: "Type /omen in Slack",
    desc: "Run the slash command in any project channel, right before you ship.",
  },
  {
    icon: "🔍",
    step: "02",
    title: "Omen reads the signals",
    desc: "Pulls your Slack context, queries your GitHub incident history via MCP, and searches real-time comparable failures.",
  },
  {
    icon: "🔮",
    step: "03",
    title: "Get a grounded forecast",
    desc: "Claude synthesises a ranked failure report — failure modes, drift signals, and three adversarial perspectives — before a single line ships.",
  },
];

const PERSONAS = [
  { icon: "💣", label: "Saboteur", color: "text-red-400", desc: "How would an adversary exploit this launch?" },
  { icon: "😤", label: "Customer", color: "text-orange-400", desc: "What breaks from the user's perspective?" },
  { icon: "🌧️", label: "Pessimist", color: "text-blue-400", desc: "What's the worst realistic outcome?" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] opacity-40"
        style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(139,92,246,0.30), transparent 70%)" }}
      />

      {/* Nav */}
      <nav className="relative border-b border-slate-800/60 px-6 py-4 flex items-center gap-3 max-w-6xl mx-auto">
        <Logo size={26} />
        <span className="font-bold text-lg tracking-tight">Omen</span>
        <div className="ml-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 rounded-lg transition-colors shadow-lg shadow-violet-900/30"
          >
            Open dashboard →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-24 pb-16 text-center max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Your launch will fail.
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
            Find out how, before it ships.
          </span>
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Omen is a Slack agent that runs an adversarial pre-mortem on your next launch —
          grounded in your own GitHub incident history, real-time external failure data,
          and your Slack channel context.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-base font-semibold bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl transition-colors shadow-xl shadow-violet-900/40"
          >
            View Launch Radar →
          </button>
          <span className="text-slate-500 text-sm font-mono bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl">
            /omen [launch name]
          </span>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="relative px-6 pb-20 max-w-5xl mx-auto">
        <DashboardPreview onOpen={() => navigate("/dashboard")} />
      </section>

      {/* How it works */}
      <section className="relative px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-bold mb-12 text-slate-100">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-xs font-bold text-slate-600 font-mono">{s.step}</span>
              </div>
              <h3 className="text-white font-semibold text-base">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack callout */}
      <section className="relative px-6 py-16 max-w-5xl mx-auto">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-xl font-bold mb-3">Genuinely grounded, not hallucinated</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every forecast is built from three real data sources — not invented context. Each leg is tagged live or demo so you always know what's real.
            </p>
          </div>
          <div className="space-y-3">
            <TechRow icon="💬" label="Slack channel context" badge="Slack API" />
            <TechRow icon="📁" label="Your GitHub incident history" badge="MCP" />
            <TechRow icon="🌐" label="Real-time comparable failures" badge="Tavily Search" />
            <TechRow icon="🔮" label="Adversarial synthesis" badge="Claude Opus" />
          </div>
        </div>
      </section>

      {/* Persona perspectives */}
      <section className="relative px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-bold mb-3 text-slate-100">Three adversarial voices</h2>
        <p className="text-center text-slate-500 text-sm mb-10">
          Every forecast includes a hostile take from three perspectives your team won't naturally think from.
        </p>
        <div className="grid sm:grid-cols-3 gap-5">
          {PERSONAS.map((p) => (
            <div
              key={p.label}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center flex flex-col items-center gap-3"
            >
              <span className="text-4xl">{p.icon}</span>
              <span className={`font-bold text-base ${p.color}`}>{p.label}</span>
              <p className="text-slate-400 text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">See the forecast before it's too late</h2>
        <p className="text-slate-500 text-sm mb-8">Every launch sends omens before it breaks.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-base font-semibold bg-violet-600 hover:bg-violet-500 text-white px-8 py-3 rounded-xl transition-colors shadow-xl shadow-violet-900/40"
        >
          Open Launch Radar →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-600">
        Omen · Built with MCP, Claude Opus, and Tavily
      </footer>
    </div>
  );
}

// ── Dashboard preview mock ────────────────────────────────────────────────────

const PREVIEW_MODES = [
  { title: "Auth changes bundled into a payments launch", sev: "CRITICAL", sevCls: "text-red-400 bg-red-500/10 border-red-500/30", lxi: "L4×I5", bar: "border-red-500 bg-red-950/30" },
  { title: "No integration tests on the refund path", sev: "HIGH",     sevCls: "text-orange-400 bg-orange-500/10 border-orange-500/30", lxi: "L4×I4", bar: "border-orange-500 bg-orange-950/30" },
  { title: "Friday-afternoon deploy with no rollback plan", sev: "HIGH", sevCls: "text-orange-400 bg-orange-500/10 border-orange-500/30", lxi: "L3×I4", bar: "border-orange-500 bg-orange-950/30" },
];

function MiniGauge({ score }: { score: number }) {
  const size = 80;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cy = size / 2;
  const cx = size / 2;
  const circumHalf = Math.PI * r;
  const fill = (score / 100) * circumHalf;
  const color = score < 40 ? "#ef4444" : score < 65 ? "#f97316" : "#22c55e";

  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path
        d={`M ${stroke / 2},${cy} A ${r},${r} 0 0 1 ${size - stroke / 2},${cy}`}
        fill="none" stroke="#1e293b" strokeWidth={stroke} strokeLinecap="round"
      />
      <path
        d={`M ${stroke / 2},${cy} A ${r},${r} 0 0 1 ${size - stroke / 2},${cy}`}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${fill} ${circumHalf}`}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="15" fontWeight="700" fontFamily="system-ui">
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="system-ui">
        / 100
      </text>
    </svg>
  );
}

function DashboardPreview({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-violet-950/40 cursor-pointer group"
      onClick={onOpen}
      title="Open dashboard"
    >
      {/* Fake browser chrome */}
      <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-3 border-b border-slate-700">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-600" />
          <span className="w-3 h-3 rounded-full bg-slate-600" />
          <span className="w-3 h-3 rounded-full bg-slate-600" />
        </div>
        <div className="flex-1 bg-slate-900 rounded px-3 py-1 text-xs text-slate-500 font-mono">
          omen-delta.vercel.app/dashboard
        </div>
        <span className="text-xs text-slate-500 group-hover:text-violet-400 transition-colors">Open →</span>
      </div>

      {/* Dashboard content */}
      <div className="bg-slate-950 px-0">
        {/* Mini nav */}
        <div className="border-b border-slate-800 px-5 py-3 flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">Omen</span>
          <span className="text-slate-600 text-xs hidden sm:block border-l border-slate-800 pl-3">
            Every launch sends omens before it breaks
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[11px] text-slate-400">Live</span>
          </div>
        </div>

        {/* Launch radar header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-bold">Launch Radar</h2>
          <p className="text-slate-500 text-xs mt-0.5">3 launches on radar, ranked by risk.</p>
        </div>

        {/* Forecast card — Payments v2 (critical) */}
        <div className="mx-5 mb-3 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-20 flex-shrink-0 flex flex-col items-center">
              <MiniGauge score={28} />
              <span className="text-[9px] text-red-400 font-medium mt-0.5">High risk</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-semibold text-sm text-white truncate">Payments v2 launch</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] uppercase text-slate-600 border border-slate-700 rounded px-1 py-0.5">demo</span>
                  <span className="text-[10px] text-slate-500">2m ago</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full mb-2.5 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "28%" }} />
              </div>
              <div className="flex gap-3 text-[10px] text-slate-400 mb-1.5">
                <span>4 failure modes</span>
                <span className="text-red-400 font-medium">🔴 2 critical</span>
                <span className="text-yellow-500">⚠️ 3 drift signals</span>
              </div>
              {/* Drift → risk linkage callout */}
              <div className="text-[10px] text-yellow-600 truncate">
                ⚠️ SSO for merchant dashboard → drives failure #1: Auth changes bundled…
              </div>
            </div>
          </div>
          {/* Failure mode pills */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
            {PREVIEW_MODES.map((m) => (
              <div key={m.title} className={`rounded border-l-2 px-2.5 py-1.5 ${m.bar} flex items-center justify-between gap-2`}>
                <span className="text-[11px] text-slate-300 truncate">{m.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${m.sevCls}`}>{m.sev}</span>
                  <span className="text-[9px] text-slate-500 font-mono">{m.lxi}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Second card — greyed out for depth */}
        <div className="mx-5 mb-5 bg-slate-900/30 border border-slate-800/60 rounded-xl p-4 opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-20 flex-shrink-0 flex flex-col items-center">
              <MiniGauge score={61} />
              <span className="text-[9px] text-yellow-400 font-medium mt-0.5">Proceed with care</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-semibold text-sm text-white truncate">iOS App Store v3.1</span>
                <span className="text-[10px] text-slate-500">14m ago</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: "61%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TechRow({ icon, label, badge }: { icon: string; label: string; badge: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl shrink-0">{icon}</span>
      <span className="text-slate-300 text-sm flex-1">{label}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide border border-slate-700 text-slate-500 px-2 py-0.5 rounded">
        {badge}
      </span>
    </div>
  );
}
