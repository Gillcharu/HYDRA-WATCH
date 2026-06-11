import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatedCounter, FadeIn } from "../components/AnimatedCounter";
import { PipelineFlow } from "../components/PipelineFlow";
import { WorldMap } from "../components/WorldMap";
import { ProofSection } from "../components/ProofSection";
import { api } from "../lib/api";
import type { MapPoint } from "../types";

const BENTO = [
  {
    icon: "RG",
    title: "121 regions · 7 clouds",
    desc: "AWS, GCP, Azure, OCI, IBM, Alibaba, DigitalOcean — every zone scored for water stress, WUE, and grid carbon.",
    span: "lg:col-span-2",
  },
  {
    icon: "PX",
    title: "Cross-cloud Pareto",
    desc: "Optimal region across all providers within your latency SLA — with migration cost modeling.",
    span: "",
  },
  {
    icon: "V4",
    title: "V0→V4 verification",
    desc: "From TDP heuristics to MLPerf benchmarks to metered CCFT ground truth.",
    span: "",
  },
  {
    icon: "24H",
    title: "Carbon scheduling",
    desc: "Hourly grid patterns — shift batch jobs to cleaner hours globally.",
    span: "",
  },
  {
    icon: "API",
    title: "Live telemetry",
    desc: "CloudWatch, access logs, billing CSV — no manual traffic guessing.",
    span: "lg:col-span-2",
  },
];

export function HomePage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [stats, setStats] = useState({ regions: 121, providers: 7, passRate: 100 });

  useEffect(() => {
    api.mapPoints().then((d) => setPoints(d.points)).catch(console.error);
    api.regions().then((d) => {
      const providers = new Set(d.regions.map((r) => r.provider));
      setStats((s) => ({ ...s, regions: d.count, providers: providers.size }));
    }).catch(console.error);
    api.validateAll().then((d) => setStats((s) => ({ ...s, passRate: d.pass_rate_pct }))).catch(console.error);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-aqua-500/30 bg-aqua-500/10 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" />
              </span>
              <span className="font-mono text-xs font-medium text-aqua-300">Live · 121 regions validated</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="headline mt-8 max-w-4xl">
              Deploy AI where the{" "}
              <span className="bg-gradient-to-r from-aqua-400 via-cyan-300 to-mint-400 bg-clip-text text-transparent">
                planet
              </span>{" "}
              can sustain it
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              HydraWatch models water, carbon, and cost for every major cloud region — then recommends greener
              alternatives within your latency budget. The decision layer investors and infra teams have been missing.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/platform" className="btn-glow">
              Connect workload source →
              </Link>
              <a href="#proof" className="btn-ghost">
                See the proof
              </a>
            </div>
          </FadeIn>

          {/* Stats strip */}
          <FadeIn delay={0.4}>
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Cloud regions", value: stats.regions },
                { label: "Providers", value: stats.providers },
                { label: "Data checks passing", value: stats.passRate, suffix: "%" },
                { label: "User locations", value: 40, suffix: "+" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-5">
                  <div className="font-display text-3xl font-bold text-white">
                    <AnimatedCounter value={s.value} suffix={s.suffix ?? ""} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-y border-white/5 bg-white/[0.02] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="section-label">How it works</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">From workload to action in one pipeline</h2>
          <div className="mt-10">
            <PipelineFlow />
          </div>
        </div>
      </section>

      {/* Proof — integrated case study */}
      <ProofSection />

      {/* Bento features */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="section-label">Capabilities</div>
            <h2 className="mt-2 font-display text-3xl font-bold text-white">Built for infra teams and ESG leaders</h2>
          </FadeIn>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENTO.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className={`bento-card h-full ${f.span}`}
                >
                  <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-aqua-500/20 bg-aqua-500/10 px-2 font-mono text-xs font-bold text-aqua-300">{f.icon}</div>
                  <h3 className="mt-4 font-display text-lg font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="section-label">Global coverage</div>
            <h2 className="mt-2 font-display text-3xl font-bold text-white">Every cloud region, scored</h2>
            <p className="mt-2 text-slate-400">Interactive sustainability map — hover any region for live metrics.</p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
              <WorldMap points={points} />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <FadeIn>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-aqua-500/20 bg-gradient-to-br from-aqua-500/10 via-abyss-800 to-mint-500/10 p-10 text-center sm:p-14">
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-aqua-500/20 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to see your footprint?
            </h2>
            <p className="relative mt-4 text-slate-400">
              Connect cloud, logs, billing CSV, or MLOps metadata. HydraWatch detects workloads automatically.
            </p>
            <Link to="/platform" className="btn-glow relative mt-8 inline-flex">
              Open the platform →
            </Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
