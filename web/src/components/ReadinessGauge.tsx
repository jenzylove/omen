interface Props {
  score: number;
  size?: number;
}

function color(score: number): string {
  if (score >= 75) return "#22c55e"; // green-500
  if (score >= 50) return "#eab308"; // yellow-500
  if (score >= 25) return "#f97316"; // orange-500
  return "#ef4444";                  // red-500
}

function label(score: number): string {
  if (score >= 75) return "Clear skies";
  if (score >= 50) return "Proceed with care";
  if (score >= 25) return "High risk";
  return "Ship at your peril";
}

export function ReadinessGauge({ score, size = 120 }: Props) {
  const stroke = 10;
  const r = size / 2 - stroke;        // arc radius (leaves room for stroke)
  const cx = size / 2;
  const cy = size / 2 + stroke / 2;   // baseline of the semicircle
  const arcLen = Math.PI * r;         // length of a semicircle
  const offset = arcLen * (1 - Math.max(0, Math.min(100, score)) / 100);

  // viewBox tall enough for the arc (top at cy - r) plus the "/ 100" label below.
  const vbHeight = cy + 22;
  const arc = `M ${stroke},${cy} A ${r},${r} 0 0 1 ${size - stroke},${cy}`;

  return (
    // Fixed width == gauge width so the label centers under the arc and can
    // never overflow the card. shrink-0 keeps it from being compressed in a flex row.
    <div className="flex flex-col items-center gap-1 shrink-0" style={{ width: size }}>
      <svg width={size} height={vbHeight} viewBox={`0 0 ${size} ${vbHeight}`}>
        {/* Track */}
        <path d={arc} fill="none" stroke="#1e293b" strokeWidth={stroke} strokeLinecap="round" />
        {/* Progress */}
        <path
          d={arc}
          fill="none"
          stroke={color(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
        />
        {/* Score — centered inside the arc opening */}
        <text
          x={cx}
          y={cy - r * 0.28}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={size * 0.26}
          fontWeight="bold"
          fontFamily="ui-monospace, monospace"
        >
          {score}
        </text>
        {/* "/ 100" just below the baseline */}
        <text x={cx} y={cy + 15} textAnchor="middle" fill="#64748b" fontSize={size * 0.1}>
          / 100
        </text>
      </svg>
      <span
        className="text-xs font-medium text-center leading-tight w-full"
        style={{ color: color(score) }}
      >
        {label(score)}
      </span>
    </div>
  );
}
