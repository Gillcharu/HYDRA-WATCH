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
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [provider, setProvider] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.mapPoints().then((d) => setPoints(d.points)).catch(console.error);
    api.regions().then((d) => {
      setAllRegions(d.regions);
      setRegions(d.regions);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const nextRegions = provider
      ? allRegions.filter((r) => r.provider.toLowerCase() === provider.toLowerCase())
      : allRegions;
    setRegions(nextRegions);
  }, [allRegions, provider]);

  const providers = [...new Set(allRegions.map((r) => r.provider))].sort();
  const filtered = regions.filter(
    (r) =>
      !search ||
      r.region_name.toLowerCase().includes(search.toLowerCase()) ||
      r.country.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredPoints = provider
    ? points.filter((p) => p.provider.toLowerCase() === provider.toLowerCase())
    : points;

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="section-label">Coverage</div>
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            {provider ? `Showing ${filtered.length} ${provider} regions` : `${allRegions.length} cloud regions`}
          </h1>
          <p className="mt-2 text-slate-600">Every major cloud zone — water stress, grid carbon, and sustainability score.</p>
        </FadeIn>

        <FadeIn>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
            <WorldMap points={filteredPoints} />
          </div>
        </FadeIn>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setProvider("")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${!provider ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${provider === p ? "text-white shadow-sm" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
              style={provider === p ? { backgroundColor: PROVIDER_COLORS[p] ?? "#0f172a" } : undefined}
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Region</th>
                  <th className="px-5 py-4">Provider</th>
                  <th className="px-5 py-4">Country</th>
                  <th className="px-5 py-4">Carbon</th>
                  <th className="px-5 py-4">Water stress</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-mono text-xs">
                      No regions match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => (
                    <motion.tr
                      key={`${r.provider}-${r.region_code}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{r.region_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{r.region_code}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: `${PROVIDER_COLORS[r.provider] ?? "#666"}15`, color: PROVIDER_COLORS[r.provider] ?? "#475569" }}
                        >
                          {r.provider}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{r.country}</td>
                      <td className="px-5 py-4 font-mono text-amber-700 font-bold">{r.carbon_kg_per_kwh}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-500"
                              style={{ width: `${Math.min(100, (r.water_stress_score / 5) * 100)}%` }}
                            />
                          </div>
                          <span className="text-slate-500">{r.water_stress_score.toFixed(2)}/5</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
