import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export function ScoreRadar({ components }: { components: Record<string, number> }) {
  const data = Object.entries(components).map(([key, value]) => ({
    subject: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: Math.round(value),
    fullMark: 100,
  }));

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Radar dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function FootprintBars({
  water,
  carbon,
  cost,
}: {
  water: number;
  carbon: number;
  cost: number;
}) {
  const max = Math.max(water / 1000, carbon, cost / 100, 1);
  const data = [
    { name: "Water (kL)", value: water / 1000, color: "#14b8a6" },
    { name: "Carbon (t)", value: carbon / 1000, color: "#f59e0b" },
    { name: "Cost ($k)", value: cost / 1000, color: "#6366f1" },
  ].map((d) => ({ ...d, pct: (d.value / max) * 100 }));

  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-400">{d.name}</span>
            <span className="font-mono font-medium text-white">
              {d.name.includes("Water")
                ? `${(water / 1000).toFixed(1)}k L`
                : d.name.includes("Carbon")
                  ? `${carbon.toLocaleString()} kg`
                  : `$${cost.toLocaleString()}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${d.pct}%`, backgroundColor: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(10, 22, 40, 0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#fff",
};

export function LeaderboardBars({ data }: { data: { name: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "#14b8a6" : i < 3 ? "#06b6d4" : "#134074"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
