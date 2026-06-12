import { useEffect, useState } from "react";
import { FadeIn } from "../components/AnimatedCounter";
import { TierBadge } from "../components/ScoreRing";
import { api } from "../lib/api";
import type { ValidationSummary } from "../types";

const TIERS = [
  { id: "V0", label: "Modeled", desc: "TDP heuristics, static grid factors", color: "from-slate-500 to-slate-600" },
  { id: "V1", label: "Published", desc: "IEA national + eGRID state carbon bands", color: "from-amber-600 to-orange-600" },
  { id: "V2", label: "Benchmarked", desc: "MLPerf measured power & throughput", color: "from-teal-600 to-cyan-600" },
  { id: "V3", label: "Live", desc: "Electricity Maps, CloudWatch telemetry", color: "from-cyan-600 to-blue-600" },
  { id: "V4", label: "Metered", desc: "CCFT / GCP carbon export ground truth", color: "from-emerald-600 to-teal-600" },
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
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">The V0→V4 ladder</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Every estimate carries a verification tier. Weakest input determines footprint tier — transparent, auditable, improvable.
          </p>
        </FadeIn>

        {/* Tier ladder */}
        <div className="mt-12 space-y-3">
          {TIERS.map((t, i) => (
            <FadeIn key={t.id}>
              <div
                className="glass flex flex-wrap items-center gap-4 rounded-xl p-5 sm:gap-6 bg-white border border-slate-200 shadow-sm"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} font-mono text-sm font-bold text-white shadow-sm`}>
                  {t.id}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-slate-900">{t.label}</div>
                  <div className="text-sm text-slate-500">{t.desc}</div>
                </div>
                <TierBadge tier={t.id} />
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Validation dashboard */}
        {data && (
          <FadeIn>
            <div className="mt-16 glass rounded-2xl p-8 bg-white border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">Global carbon validation</h2>
                  <p className="mt-2 text-slate-600">{data.summary}</p>
                </div>
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="#0d9488" strokeWidth="8"
                      strokeDasharray={`${data.pass_rate_pct * 2.64} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="font-display text-2xl font-bold text-teal-700">{data.pass_rate_pct}%</div>
                    <div className="text-[10px] text-slate-500">pass rate</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-slate-800">{data.total}</div>
                  <div className="text-xs text-slate-500">Regions validated</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-emerald-700">{data.passed}</div>
                  <div className="text-xs text-slate-500">Within bands</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="font-display text-3xl font-bold text-slate-800">{failed.length}</div>
                  <div className="text-xs text-slate-500">Outliers</div>
                </div>
              </div>

              {failed.length === 0 ? (
                <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center text-sm text-emerald-800">
                  ✓ All {data.total} regions within published IEA + eGRID carbon bands
                </div>
              ) : (
                <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Region</th>
                        <th className="px-4 py-3 text-left">Carbon</th>
                        <th className="px-4 py-3 text-left">Band</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failed.map((r) => (
                        <tr key={r.region_code} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-900">{r.provider} {r.region_name}</td>
                          <td className="px-4 py-3 font-mono text-amber-700 font-bold">{r.carbon}</td>
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
