import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FadeIn } from "../components/AnimatedCounter";
import { LeaderboardBars } from "../components/Charts";
import { ScoreRing } from "../components/ScoreRing";
import { api } from "../lib/api";
import type { LeaderboardEntry } from "../types";

function formatRegionDisplayName(regionCode: string, regionName: string, country: string, city?: string): string {
  let geo = "";
  if (city && country) {
    geo = `${city}, ${country}`;
  } else if (regionName) {
    let cleanName = regionName;
    const match = regionName.match(/\(([^)]+)\)/);
    if (match) {
      cleanName = match[1];
    }
    geo = country ? `${cleanName}, ${country}` : cleanName;
  } else {
    geo = country || "";
  }
  return regionCode ? `${regionCode} · ${geo}` : geo;
}

function formatCarbonValue(kg: number): string {
  const lbs = kg * 2.20462;
  return `${Math.round(kg).toLocaleString()} kg (${Math.round(lbs).toLocaleString()} lbs)`;
}

export function LeaderboardPage() {
  const [location, setLocation] = useState("Mumbai, India");
  const [locations, setLocations] = useState<string[]>([]);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.locations().then((d) => setLocations(d.locations)).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ user_location: location, top_n: "20" });
      setBoard((await api.leaderboard(params)).leaderboard);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => { load(); }, [load]);

  const top3 = board.slice(0, 3);
  const chartData = board.slice(0, 10).map((b) => ({
    name: b.region_name.split("(")[0].trim().slice(0, 14),
    score: b.sustainability_score,
  }));

  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="section-label">Rankings</div>
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Global sustainability leaderboard</h1>
          <p className="mt-2 text-slate-600">Top regions worldwide within your latency budget — ranked by composite score.</p>
        </FadeIn>

        <FadeIn>
          <div className="mt-8 flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1">
              <label className="label-dark">User location</label>
              <select className="input-dark" value={location} onChange={(e) => setLocation(e.target.value)}>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <button type="button" className="btn-glow" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh rankings"}
            </button>
          </div>
        </FadeIn>

        {/* Podium */}
        {podiumOrder.length >= 3 && (
          <FadeIn>
            <div className="mt-12 flex items-end justify-center gap-4 sm:gap-8">
              {podiumOrder.map((b, i) => {
                const rank = b.rank;
                const heights = ["h-28", "h-36", "h-20"];
                const rankLabels = ["Rank 02", "Rank 01", "Rank 03"];
                const labelColors = ["text-slate-500", "text-teal-700", "text-slate-650"];
                return (
                  <motion.div
                    key={b.region_code}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex flex-col items-center ${i === 1 ? "order-none" : ""}`}
                  >
                    <div className={`mb-2 font-mono text-[10px] font-bold uppercase tracking-widest ${labelColors[i]}`}>
                      {rankLabels[i]}
                    </div>
                    <ScoreRing score={b.sustainability_score} size={i === 1 ? 120 : 90} />
                    <div className="mt-3 max-w-[140px] text-center">
                      <div className="truncate font-semibold text-slate-900 text-xs" title={formatRegionDisplayName(b.region_code, b.region_name, b.country)}>
                        {formatRegionDisplayName(b.region_code, b.region_name, b.country)}
                      </div>
                      <div className="text-[10px] text-slate-500">{b.provider}</div>
                    </div>
                    <div className={`mt-4 w-24 rounded-t-lg bg-slate-100 border-x border-t border-slate-200 ${heights[i]} flex items-end justify-center pb-2`}>
                      <span className="font-mono text-lg font-bold text-slate-700">#{rank}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </FadeIn>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <FadeIn>
            <div className="glass rounded-2xl p-6 bg-white border border-slate-200 shadow-sm">
              <h3 className="font-display font-bold text-slate-900">Top 10 scores</h3>
              {chartData.length > 0 && (
                <div className="mt-4">
                  <LeaderboardBars data={chartData} />
                </div>
              )}
            </div>
          </FadeIn>

          <FadeIn>
            <div className="glass overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Region</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Carbon</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((b) => (
                    <tr key={b.region_code} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-display font-bold text-teal-600">{b.rank}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {formatRegionDisplayName(b.region_code, b.region_name, b.country)}
                        </div>
                        <div className="text-xs text-slate-500">{b.provider} · {b.latency_ms}ms</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{b.sustainability_score}</td>
                      <td className="px-4 py-3 font-mono text-amber-700 font-bold">
                        {formatCarbonValue(b.carbon_month_kg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
