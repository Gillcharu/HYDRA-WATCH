import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FadeIn } from "./AnimatedCounter";
import { ScoreRing, TierBadge } from "./ScoreRing";
import { api } from "../lib/api";
import type { CaseStudy } from "../types";

export function ProofSection() {
  const [cs, setCs] = useState<CaseStudy | null>(null);

  useEffect(() => {
    api.caseStudy().then(setCs).catch(console.error);
  }, []);

  if (!cs) {
    return (
      <section id="proof" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl animate-pulse rounded-2xl bg-white/5 h-96" />
      </section>
    );
  }

  const mumbai = cs.mumbai as { score: number; carbon_kg_month: number; water_L_month: number; footprint_tier: string };
  const stockholm = cs.stockholm as { score: number; carbon_kg_month: number; water_L_month: number; footprint_tier: string };
  const findings = cs.findings as { carbon_reduction_pct: number; carbon_ratio_mumbai_to_stockholm: number; score_improvement: number };

  return (
    <section id="proof" className="relative px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="section-label">Validated proof</div>
              <h2 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
                Same workload. 95% less carbon.
              </h2>
              <p className="mt-3 max-w-xl text-slate-600">
                LLaMA-3-70B on A100 · 150 QPS · Mumbai users. Moving to AWS Stockholm cuts carbon by{" "}
                <strong className="text-teal-600 font-bold">{findings.carbon_reduction_pct}%</strong> — consistent with IEA grid factors.
              </p>
            </div>
            {cs.pass && (
              <span className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 font-mono text-xs font-bold text-teal-700">
                ✓ REPRODUCIBLE
              </span>
            )}
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Mumbai */}
          <FadeIn>
            <div className="glass relative overflow-hidden rounded-2xl p-8">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-red-600">Current deployment</div>
                  <h3 className="mt-1 font-display text-2xl font-bold text-slate-900">Mumbai</h3>
                  <div className="mt-1 font-mono text-xs text-slate-500">AWS ap-south-1</div>
                </div>
                <ScoreRing score={mumbai.score} size={100} />
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="text-2xl font-bold text-amber-600">{mumbai.carbon_kg_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">kg CO₂ / month</div>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="text-2xl font-bold text-cyan-600">{mumbai.water_L_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">L water / month</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <TierBadge tier={mumbai.footprint_tier} />
                <span className="text-xs text-slate-500">India grid ~0.71 kg/kWh</span>
              </div>
            </div>
          </FadeIn>

          {/* Stockholm */}
          <FadeIn>
            <div className="glass relative overflow-hidden rounded-2xl p-8 border-teal-200">
              <div className="absolute left-4 top-4 rounded-full bg-teal-50 border border-teal-200/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Recommended
              </div>
              <div className="flex items-start justify-between pt-6">
                <div>
                  <div className="text-sm font-semibold text-teal-600">Greener alternative</div>
                  <h3 className="mt-1 font-display text-2xl font-bold text-slate-900">Stockholm</h3>
                  <div className="mt-1 font-mono text-xs text-slate-500">AWS eu-north-1</div>
                </div>
                <ScoreRing score={stockholm.score} size={100} />
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-teal-50/50 border border-teal-100 p-4">
                  <div className="text-2xl font-bold text-teal-600">{stockholm.carbon_kg_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">kg CO₂ / month</div>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="text-2xl font-bold text-cyan-600">{stockholm.water_L_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">L water / month</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <TierBadge tier={stockholm.footprint_tier} />
                <span className="text-xs text-slate-500">Sweden grid ~0.04 kg/kWh</span>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-100/50 p-6">
            <p className="text-sm text-slate-600">{cs.conclusion}</p>
            <Link to="/platform" className="btn-glow shrink-0 !py-2.5 !text-xs">
              Run your own analysis →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
