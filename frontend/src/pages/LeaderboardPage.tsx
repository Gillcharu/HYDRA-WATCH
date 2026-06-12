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

        {/* Top 3 Cards Grid */}
        {top3.length > 0 && (
          <FadeIn>
            <div className="mt-12 grid gap-6 md:grid-cols-3 items-stretch">
              {top3.map((b) => {
                const isRank1 = b.rank === 1;
                return (
                  <motion.div
                    key={b.region_code}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: b.rank * 0.08 }}
                    className={`glass relative overflow-hidden rounded-xl p-6 bg-white border transition-all ${
                      isRank1 
                        ? "border-teal-500 ring-1 ring-teal-100/50 shadow-md md:scale-105 z-10" 
                        : "border-slate-200 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    {isRank1 && (
                      <span className="absolute top-4 right-4 rounded-full bg-teal-100 px-2 py-0.5 font-mono text-[9px] font-bold text-teal-800 uppercase tracking-wider">
                        Best Option
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-mono text-3xl font-extrabold text-slate-200 tracking-tighter">
                          0{b.rank}
                        </div>
                        <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {b.provider}
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 border border-slate-200 font-display text-lg font-bold text-slate-900">
                        {b.sustainability_score}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="inline-block font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {b.region_code}
                      </div>
                      <h3 className="mt-2.5 font-display text-sm font-semibold leading-tight text-slate-900">
                        {b.region_name}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {b.country}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-slate-400 uppercase font-mono text-[9px] tracking-wider">Est. Carbon</div>
                        <strong className="block mt-0.5 text-slate-800 font-mono">{Math.round(b.carbon_month_kg).toLocaleString()} kg/mo</strong>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase font-mono text-[9px] tracking-wider">Latency</div>
                        <strong className="block mt-0.5 text-slate-800 font-mono">{b.latency_ms} ms</strong>
                      </div>
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
