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
              <h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
                Same workload. 95% less carbon.
              </h2>
              <p className="mt-3 max-w-xl text-slate-400">
                LLaMA-3-70B on A100 · 150 QPS · Mumbai users. Moving to AWS Stockholm cuts carbon by{" "}
                <strong className="text-mint-400">{findings.carbon_reduction_pct}%</strong> — consistent with IEA grid factors.
              </p>
            </div>
            {cs.pass && (
              <span className="rounded-full border border-mint-500/40 bg-mint-500/10 px-4 py-2 font-mono text-xs font-bold text-mint-400">
                ✓ REPRODUCIBLE
              </span>
            )}
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Mumbai */}
          <FadeIn delay={0.1}>
            <motion.div
              className="glass relative overflow-hidden rounded-2xl p-8"
              whileHover={{ borderColor: "rgba(239, 68, 68, 0.3)" }}
            >
              <div className="absolute right-0 top-0 h-32 w-32 bg-red-500/10 blur-3xl" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-red-400">Current deployment</div>
                  <h3 className="mt-1 font-display text-2xl font-bold text-white">Mumbai</h3>
                  <div className="mt-1 font-mono text-xs text-slate-500">AWS ap-south-1</div>
                </div>
                <ScoreRing score={mumbai.score} size={100} />
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/5 p-4">
                  <div className="text-2xl font-bold text-amber-400">{mumbai.carbon_kg_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">kg CO₂ / month</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <div className="text-2xl font-bold text-cyan-400">{mumbai.water_L_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">L water / month</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <TierBadge tier={mumbai.footprint_tier} />
                <span className="text-xs text-slate-500">India grid ~0.71 kg/kWh</span>
              </div>
            </motion.div>
          </FadeIn>

          {/* Stockholm */}
          <FadeIn delay={0.2}>
            <motion.div
              className="glass relative overflow-hidden rounded-2xl border-mint-500/20 p-8"
              whileHover={{ borderColor: "rgba(20, 184, 166, 0.4)" }}
            >
              <div className="absolute right-0 top-0 h-32 w-32 bg-mint-500/15 blur-3xl" />
              <div className="absolute left-4 top-4 rounded-full bg-mint-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-mint-400">
                Recommended
              </div>
              <div className="flex items-start justify-between pt-6">
                <div>
                  <div className="text-sm font-medium text-mint-400">Greener alternative</div>
                  <h3 className="mt-1 font-display text-2xl font-bold text-white">Stockholm</h3>
                  <div className="mt-1 font-mono text-xs text-slate-500">AWS eu-north-1</div>
                </div>
                <ScoreRing score={stockholm.score} size={100} />
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-mint-500/10 p-4">
                  <div className="text-2xl font-bold text-mint-400">{stockholm.carbon_kg_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">kg CO₂ / month</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <div className="text-2xl font-bold text-cyan-400">{stockholm.water_L_month.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">L water / month</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <TierBadge tier={stockholm.footprint_tier} />
                <span className="text-xs text-slate-500">Sweden grid ~0.04 kg/kWh</span>
              </div>
            </motion.div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-slate-400">{cs.conclusion}</p>
            <Link to="/platform" className="btn-glow shrink-0 !py-2.5 !text-xs">
              Run your own analysis →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
