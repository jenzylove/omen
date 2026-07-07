/** Omen crystal-ball mark. Scales to any size. */
export function Logo({ size = 28 }: { size?: number }) {
  const id = "omen-orb";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Omen">
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="14" r="9.5" fill={`url(#${id})`} />
      <ellipse cx="12.3" cy="10.3" rx="2.7" ry="1.7" fill="#ffffff" opacity="0.55" />
      <path d="M8 24 h16 l-2.4 3.2 h-11.2 z" fill="#475569" />
    </svg>
  );
}
