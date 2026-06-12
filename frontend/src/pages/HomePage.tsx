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
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-600" />
              </span>
              <span className="font-mono text-xs font-semibold text-slate-600">Live · 121 regions validated</span>
            </div>
          </FadeIn>

          <FadeIn>
            <h1 className="headline mt-8 max-w-4xl text-slate-900">
              Deploy AI where the{" "}
              <span className="text-teal-600">
                planet
              </span>{" "}
              can sustain it
            </h1>
          </FadeIn>

          <FadeIn>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Pick a model and region. See how much water and carbon your workload uses, then find greener alternatives within your latency budget.
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
          <FadeIn>
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Cloud regions", value: stats.regions },
                { label: "Providers", value: stats.providers },
                { label: "Data checks passing", value: stats.passRate, suffix: "%" },
                { label: "User locations", value: 40, suffix: "+" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-5">
                  <div className="font-display text-3xl font-bold text-slate-900">
                    <AnimatedCounter value={s.value} suffix={s.suffix ?? ""} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Estimator Promotion Section */}
      <section className="px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  For Individuals
                </span>
                <h2 className="mt-3 font-display text-2xl font-bold text-slate-900">
                  Estimate the footprint of one AI search
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Estimate the water, energy, and carbon consumed by a single query across ChatGPT, Gemini, Claude, or Copilot.
                </p>
              </div>
              <Link to="/personal-estimator" className="btn-glow shrink-0">
                Check one AI query →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-y border-slate-200 bg-slate-100/50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="section-label">How it works</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">From workload to action in one pipeline</h2>
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
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">AI infrastructure sustainability intelligence</h2>
          </FadeIn>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENTO.map((f) => (
              <FadeIn key={f.title}>
                <div className="bento-card h-full">
                  <h3 className="font-display text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
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
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Every cloud region, scored</h2>
            <p className="mt-2 text-slate-600">Interactive sustainability map — hover any region for live metrics.</p>
          </FadeIn>
          <FadeIn>
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
              <WorldMap points={points} />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <FadeIn>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 p-10 text-center sm:p-14 shadow-sm">
            <h2 className="relative font-display text-3xl font-bold text-slate-900 sm:text-4xl">
              Ready to see your footprint?
            </h2>
            <p className="relative mt-4 text-slate-600">
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
