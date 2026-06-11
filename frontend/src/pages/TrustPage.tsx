import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FadeIn } from "../components/AnimatedCounter";
import { TierBadge } from "../components/ScoreRing";
import { api } from "../lib/api";
import type { ValidationSummary } from "../types";

const TIERS = [
  { id: "V0", label: "Modeled", desc: "TDP heuristics, static grid factors", color: "from-slate-500 to-slate-600" },
  { id: "V1", label: "Published", desc: "IEA national + eGRID state carbon bands", color: "from-amber-500 to-orange-500" },
  { id: "V2", label: "Benchmarked", desc: "MLPerf measured power & throughput", color: "from-violet-500 to-purple-500" },
  { id: "V3", label: "Live", desc: "Electricity Maps, CloudWatch telemetry", color: "from-cyan-500 to-blue-500" },
  { id: "V4", label: "Metered", desc: "CCFT / GCP carbon export ground truth", color: "from-emerald-500 to-teal-500" },
];

export function TrustPage() {
  const [data, setData] = useState<ValidationSummary | null>(null);

  useEffect(() => {
    api.validateAll().then(setData).catch(console.error);
  }, []);

  const failed = data?.results.filter((r) => !r.pass) ?? [];

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="section-label">Trust & verification</div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">The V0→V4 ladder</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Every estimate carries a verification tier. Weakest input determines footprint tier — transparent, auditable, improvable.
          </p>
        </FadeIn>

        {/* Tier ladder */}
        <div className="mt-12 space-y-3">
          {TIERS.map((t, i) => (
            <FadeIn key={t.id} delay={i * 0.06}>
              <motion.div
                className="glass flex flex-wrap items-center gap-4 rounded-xl p-5 sm:gap-6"
                whileHover={{ x: 4 }}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} font-mono text-sm font-bold text-white shadow-lg`}>
                  {t.id}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-white">{t.label}</div>
                  <div className="text-sm text-slate-500">{t.desc}</div>
                </div>
                <TierBadge tier={t.id} />
              </motion.div>
            </FadeIn>
          ))}
        </div>

        {/* Validation dashboard */}
        {data && (
          <FadeIn delay={0.35}>
            <div className="mt-16 glass rounded-2xl p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Global carbon validation</h2>
                  <p className="mt-2 text-slate-400">{data.summary}</p>
                </div>
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="#14b8a6" strokeWidth="8"
                      strokeDasharray={`${data.pass_rate_pct * 2.64} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="font-display text-2xl font-bold text-mint-400">{data.pass_rate_pct}%</div>
                    <div className="text-[10px] text-slate-500">pass rate</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-white">{data.total}</div>
                  <div className="text-xs text-slate-500">Regions validated</div>
                </div>
                <div className="rounded-xl bg-mint-500/10 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-mint-400">{data.passed}</div>
                  <div className="text-xs text-slate-500">Within bands</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-white">{failed.length}</div>
                  <div className="text-xs text-slate-500">Outliers</div>
                </div>
              </div>

              {failed.length === 0 ? (
                <div className="mt-8 rounded-xl border border-mint-500/30 bg-mint-500/10 p-4 text-center text-sm text-mint-300">
                  ✓ All {data.total} regions within published IEA + eGRID carbon bands
                </div>
              ) : (
                <div className="mt-8 overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Region</th>
                        <th className="px-4 py-3 text-left">Carbon</th>
                        <th className="px-4 py-3 text-left">Band</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failed.map((r) => (
                        <tr key={r.region_code} className="border-t border-white/[0.03]">
                          <td className="px-4 py-3 text-white">{r.provider} {r.region_name}</td>
                          <td className="px-4 py-3 font-mono text-amber-400">{r.carbon}</td>
                          <td className="px-4 py-3 text-slate-500">{r.band} ({r.band_source})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
