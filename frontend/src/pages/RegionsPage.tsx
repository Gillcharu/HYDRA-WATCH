import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FadeIn } from "../components/AnimatedCounter";
import { WorldMap } from "../components/WorldMap";
import { api } from "../lib/api";
import type { MapPoint, Region } from "../types";

const PROVIDER_COLORS: Record<string, string> = {
  AWS: "#ff9900",
  GCP: "#4285f4",
  Azure: "#0078d4",
  OCI: "#c74634",
  IBM: "#054ada",
  Alibaba: "#ff6a00",
  DigitalOcean: "#0080ff",
};

export function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [provider, setProvider] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.mapPoints().then((d) => setPoints(d.points)).catch(console.error);
  }, []);

  useEffect(() => {
    api.regions(provider || undefined).then((d) => setRegions(d.regions)).catch(console.error);
  }, [provider]);

  const providers = [...new Set(regions.map((r) => r.provider))].sort();
  const filtered = regions.filter(
    (r) =>
      !search ||
      r.region_name.toLowerCase().includes(search.toLowerCase()) ||
      r.country.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="section-label">Coverage</div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">121 cloud regions</h1>
          <p className="mt-2 text-slate-400">Every major cloud zone — water stress, grid carbon, and sustainability score.</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            <WorldMap points={points} />
          </div>
        </FadeIn>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setProvider("")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${!provider ? "bg-aqua-500 text-abyss-950" : "glass text-slate-300 hover:text-white"}`}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${provider === p ? "text-abyss-950" : "glass text-slate-300 hover:text-white"}`}
              style={provider === p ? { backgroundColor: PROVIDER_COLORS[p] ?? "#06b6d4" } : undefined}
            >
              {p}
            </button>
          ))}
          <input
            type="search"
            placeholder="Search regions…"
            className="input-dark ml-auto w-full max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/5 bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Region</th>
                  <th className="px-5 py-4">Provider</th>
                  <th className="px-5 py-4">Country</th>
                  <th className="px-5 py-4">Carbon</th>
                  <th className="px-5 py-4">Water stress</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr
                    key={`${r.provider}-${r.region_code}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="border-b border-white/[0.03] transition hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{r.region_name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{r.region_code}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: `${PROVIDER_COLORS[r.provider] ?? "#666"}22`, color: PROVIDER_COLORS[r.provider] ?? "#94a3b8" }}
                      >
                        {r.provider}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{r.country}</td>
                    <td className="px-5 py-4 font-mono text-amber-400/90">{r.carbon_kg_per_kwh}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-500"
                            style={{ width: `${Math.min(100, (r.water_stress_score / 5) * 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-500">{r.water_stress_score}/5</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
