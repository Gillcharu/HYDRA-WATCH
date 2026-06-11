export function ScoreRing({
  score,
  size = 140,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;
  const color =
    score >= 70 ? "#14b8a6" : score >= 45 ? "#06b6d4" : score >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90 drop-shadow-lg">
        <defs>
          <linearGradient id={`score-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#score-grad-${size})`}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-3xl font-bold text-white">{Math.round(score)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label ?? "Score"}
        </div>
      </div>
    </div>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    V4: "from-emerald-400 to-teal-500",
    V3: "from-cyan-400 to-blue-500",
    V2: "from-violet-400 to-purple-500",
    V1: "from-amber-400 to-orange-500",
    V0: "from-slate-400 to-slate-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r ${colors[tier] ?? colors.V0} px-2.5 py-0.5 font-mono text-[10px] font-bold text-abyss-950`}
    >
      {tier}
    </span>
  );
}
