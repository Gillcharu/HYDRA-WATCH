import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreRing, TierBadge } from "../components/ScoreRing";
import { ScoreRadar, FootprintBars } from "../components/Charts";
import { FadeIn } from "../components/AnimatedCounter";
import { api } from "../lib/api";
import type { AnalyzeRequest, AnalyzeResult, Meta, Region, Scenario } from "../types";

function formatRegionName(provider: string, name: string) {
  let cleanName = name;
  const match = name.match(/\(([^)]+)\)/);
  if (match) {
    cleanName = match[1];
  }
  return `${provider} ${cleanName}`;
}

const DEFAULT: AnalyzeRequest = {
  provider: "AWS",
  region_code: "ap-south-1",
  qps: 150,
  avg_tokens: 1000,
  gpu_type: "A100",
  model_name: "LLaMA-3-70B",
  user_location: "Mumbai, India",
  max_latency_ms: 200,
  workload_mode: "inference",
  quantization: "FP16",
  framework: "standard",
};

const SOURCES = [
  { id: "cloud", title: "Cloud account", desc: "Cost Explorer, Azure Cost Management, GCP Billing" },
  { id: "logs", title: "Telemetry logs", desc: "CloudWatch, API gateway, access logs" },
  { id: "csv", title: "Billing CSV", desc: "Monthly exports from finance or cloud console" },
  { id: "mlops", title: "MLOps registry", desc: "Model, endpoint, GPU, and deployment metadata" },
];

const DETECTED_WORKLOADS = [
  {
    id: "support-copilot",
    name: "Customer Support Copilot",
    source: "AWS Cost Explorer + CloudWatch",
    owner: "Customer Experience",
    params: DEFAULT,
  },
  {
    id: "rag-assistant",
    name: "Internal RAG Assistant",
    source: "GCP Billing Export + API Gateway",
    owner: "Knowledge Platform",
    params: {
      ...DEFAULT,
      provider: "GCP",
      region_code: "asia-south1",
      qps: 120,
      avg_tokens: 850,
      gpu_type: "A100",
      model_name: "LLaMA-3-8B",
      max_latency_ms: 180,
      quantization: "FP8",
      framework: "vllm",
    },
  },
  {
    id: "batch-summary",
    name: "Batch Summarization Job",
    source: "Azure ML Registry + Billing CSV",
    owner: "Data Platform",
    params: {
      ...DEFAULT,
      provider: "Azure",
      region_code: "centralindia",
      qps: 45,
      avg_tokens: 2400,
      gpu_type: "H100",
      model_name: "Claude-Sonnet",
      max_latency_ms: 250,
      workload_mode: "batch",
      quantization: "INT4",
      framework: "tensorrt",
    },
  },
];

export function PlatformPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [params, setParams] = useState<AnalyzeRequest>(DEFAULT);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeScenario, setActiveScenario] = useState("india_llm");
  const [activeSource, setActiveSource] = useState("cloud");
  const [activeWorkload, setActiveWorkload] = useState(DETECTED_WORKLOADS[0].id);
  const [refOpen, setRefOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [liveTelemetry, setLiveTelemetry] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(console.error);
    api.locations().then((d) => setLocations(d.locations)).catch(console.error);
  }, []);

  useEffect(() => {
    api.regions(params.provider).then((d) => {
      setRegions(d.regions);
      if (d.regions.length && !d.regions.some((r) => r.region_code === params.region_code)) {
        setParams((p) => ({ ...p, region_code: d.regions[0].region_code }));
      }
    }).catch(console.error);
  }, [params.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await api.analyze({ ...params, live_telemetry: liveTelemetry }, 6, apiKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [params, liveTelemetry, apiKey]);

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyScenario(s: Scenario) {
    setActiveScenario(s.id);
    setActiveWorkload("");
    setParams({
      ...params,
      provider: s.provider,
      region_code: s.region,
      model_name: s.model,
      gpu_type: s.gpu,
      qps: s.qps,
      avg_tokens: s.tokens,
      user_location: s.location,
      max_latency_ms: s.latency,
    });
  }

  function applyDetectedWorkload(workload: (typeof DETECTED_WORKLOADS)[number]) {
    setActiveScenario("");
    setActiveWorkload(workload.id);
    setParams(workload.params);
  }

  const fp = result?.current.footprint;
  const components = result?.current.score_components ?? {};

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="section-label">Platform</div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Workload intelligence</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Connect workload data from cloud, logs, billing, or MLOps systems. HydraWatch detects the deployment shape
            and returns water, carbon, cost, and greener cross-cloud alternatives.
          </p>
        </FadeIn>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => setActiveSource(source.id)}
              className={`glass rounded-xl p-4 text-left transition ${
                activeSource === source.id
                  ? "border-aqua-500/50 bg-aqua-500/10 ring-1 ring-aqua-500/30"
                  : "hover:border-white/20"
              }`}
            >
              <div className="font-semibold text-white">{source.title}</div>
              <div className="mt-1 text-xs text-slate-500">{source.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Detected workloads</h2>
              <p className="mt-1 text-sm text-slate-500">Auto-discovered from the selected source. Choose one to analyze.</p>
            </div>
            <span className="rounded-full border border-mint-500/30 bg-mint-500/10 px-3 py-1 font-mono text-xs text-mint-300">
              Source connected
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {DETECTED_WORKLOADS.map((workload) => (
              <button
                key={workload.id}
                type="button"
                onClick={() => applyDetectedWorkload(workload)}
                className={`glass rounded-xl p-4 text-left transition ${
                  activeWorkload === workload.id
                    ? "border-aqua-500/50 bg-aqua-500/10 ring-1 ring-aqua-500/30"
                    : "hover:border-white/20"
                }`}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-aqua-300">{workload.source}</div>
                <div className="mt-2 font-semibold text-white">{workload.name}</div>
                <div className="mt-1 text-xs text-slate-500">{workload.owner}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
                   <span>{workload.params.provider} · {workload.params.region_code}</span>
                  <span>{workload.params.gpu_type}</span>
                  <span>{workload.params.model_name}</span>
                  <span>~{(workload.params.qps * 0.0864).toFixed(1)}M requests/day</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-12">
          {/* Config panel */}
          <div className="glass rounded-2xl p-6 xl:col-span-4">
            <h2 className="font-display font-bold text-white">Detected deployment</h2>
            <p className="mt-1 text-xs text-slate-500">These fields are populated from connected systems. Advanced overrides are available for testing.</p>
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                {[
                   ["Provider", params.provider],
                  ["Region", params.region_code],
                  ["Model", params.model_name],
                  ["GPU", params.gpu_type],
                  ["Traffic", `~${(params.qps * 0.0864).toFixed(1)}M req/day · ${params.avg_tokens.toLocaleString()} tokens/req`],
                  ["Users", `${params.user_location} · ${params.max_latency_ms} ms SLA`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-slate-500">{label}</span>
                    <strong className="text-right text-white">{value}</strong>
                  </div>
                ))}
              </div>

              <details className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300">Advanced override / testing</summary>
                <div className="mt-4 space-y-4">
                  {meta?.scenarios && (
                    <div>
                      <label className="label-dark">Fallback scenario template</label>
                      <select className="input-dark" value={activeScenario} onChange={(e) => {
                        const scenario = meta.scenarios.find((s) => s.id === e.target.value);
                        if (scenario) applyScenario(scenario);
                      }}>
                        <option value="" className="bg-abyss-900">None</option>
                        {meta.scenarios.map((s) => <option key={s.id} value={s.id} className="bg-abyss-900">{s.title}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label-dark">Provider</label>
                    <select className="input-dark" value={params.provider} onChange={(e) => setParams({ ...params, provider: e.target.value, region_code: "" })}>
                      {meta?.providers.map((p) => <option key={p.id} value={p.id} className="bg-abyss-900">{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-dark">Region</label>
                    <select className="input-dark" value={params.region_code} onChange={(e) => setParams({ ...params, region_code: e.target.value })}>
                      {regions.map((r) => <option key={r.region_code} value={r.region_code} className="bg-abyss-900">{r.region_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-dark">User location</label>
                    <select className="input-dark" value={params.user_location} onChange={(e) => setParams({ ...params, user_location: e.target.value })}>
                      {locations.map((l) => <option key={l} value={l} className="bg-abyss-900">{l}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-dark">GPU</label>
                      <select className="input-dark" value={params.gpu_type} onChange={(e) => setParams({ ...params, gpu_type: e.target.value })}>
                        {meta?.gpus.map((g) => <option key={g} value={g} className="bg-abyss-900">{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-dark">Model</label>
                      <select className="input-dark" value={params.model_name} onChange={(e) => setParams({ ...params, model_name: e.target.value })}>
                        {meta?.models.map((m) => <option key={m} value={m} className="bg-abyss-900">{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-dark">Quantization</label>
                      <select className="input-dark" value={params.quantization || "FP16"} onChange={(e) => setParams({ ...params, quantization: e.target.value })}>
                        <option value="FP16" className="bg-abyss-900">FP16</option>
                        <option value="FP8" className="bg-abyss-900">FP8</option>
                        <option value="INT4" className="bg-abyss-900">INT4</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-dark">Framework</label>
                      <select className="input-dark" value={params.framework || "standard"} onChange={(e) => setParams({ ...params, framework: e.target.value })}>
                        <option value="standard" className="bg-abyss-900">Standard</option>
                        <option value="vllm" className="bg-abyss-900">vLLM</option>
                        <option value="tensorrt" className="bg-abyss-900">TensorRT-LLM</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-dark">Traffic (QPS)</label>
                      <input type="number" className="input-dark" value={params.qps} onChange={(e) => setParams({ ...params, qps: +e.target.value })} />
                    </div>
                    <div>
                      <label className="label-dark">Request size (tokens)</label>
                      <input type="number" className="input-dark" value={params.avg_tokens} onChange={(e) => setParams({ ...params, avg_tokens: +e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label-dark">Max latency (ms)</label>
                    <input type="number" className="input-dark" value={params.max_latency_ms} onChange={(e) => setParams({ ...params, max_latency_ms: +e.target.value })} />
                  </div>
                  <div>
                    <label className="label-dark">API Key / Tenant Token</label>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="e.g. hw_cx_key (Optional)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-white/5 mt-2">
                    <label className="text-xs font-semibold text-slate-400 cursor-pointer" htmlFor="live-telemetry">
                      Enable Live DCIM Telemetry
                    </label>
                    <input
                      id="live-telemetry"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-aqua-500 focus:ring-aqua-500 focus:ring-offset-slate-900"
                      checked={liveTelemetry}
                      onChange={(e) => setLiveTelemetry(e.target.checked)}
                    />
                  </div>
                </div>
              </details>
              <button type="button" className="btn-glow w-full" onClick={run} disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-abyss-950 border-t-transparent" />
                    Generating…
                  </span>
                ) : (
                  "Generate recommendation"
                )}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </div>

          {/* Results dashboard */}
          <div className="space-y-6 xl:col-span-8">
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key={result.current.region_code + result.current.sustainability_score}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Water table basin stress warning */}
                  {result.current.water_stress_score !== undefined && result.current.water_stress_score > 3.0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/40 to-amber-950/30 p-6 backdrop-blur-md"
                    >
                      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                          <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-display font-bold text-red-200">High Water Stress Alert</h3>
                          <p className="text-sm text-red-300/90 leading-relaxed">
                            The regional water tables in <strong>{result.current.region_name} ({result.current.region_code})</strong> are experiencing severe depletion.
                            High seasonal heat and heavy municipal/industrial demand have placed local water basins in critical stress. Running dense AI compute workloads here increases grid and cooling-water demand in an already constrained region.
                          </p>
                          <div className="grid gap-3 pt-2 sm:grid-cols-3">
                            <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Basin Stress Score</span>
                              <strong className="font-display text-lg text-red-400">{result.current.water_stress_score.toFixed(2)} / 5.0</strong>
                              <span className="block text-xs text-slate-400">{result.current.water_stress_label || "Extremely High"}</span>
                            </div>
                            <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Drought Index</span>
                              <strong className="font-display text-lg text-amber-400">{result.current.drought_risk?.toFixed(2)} / 5.0</strong>
                              <span className="block text-xs text-slate-400">Severe Drought Risk</span>
                            </div>
                            <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Local Reservoirs</span>
                              <strong className="font-display text-sm text-red-300 font-bold">HIGH STRESS</strong>
                              <span className="block text-xs text-slate-400">Restricted usage active</span>
                            </div>
                          </div>
                          <div className="mt-4 rounded-lg bg-red-950/20 p-3 border border-red-500/10 text-xs text-red-200">
                            <strong>Dispatch Action Prompted:</strong> High-risk workload detected. We recommend dispatching this workload to a low water-stress alternative, such as <strong>{result.multicloud[0]?.region_name || "eu-north-1 (Stockholm)"}</strong> to preserve vital local freshwater tables.
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                   {/* Top Action Recommendation Callout */}
                  {result.multicloud.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative overflow-hidden rounded-2xl border border-mint-500/30 bg-gradient-to-r from-mint-950/40 to-abyss-950/50 p-6 backdrop-blur-md shadow-lg shadow-mint-950/20"
                    >
                      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint-500/10 blur-2xl animate-pulse" />
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mint-500/20 text-mint-400 border border-mint-500/30 shadow-inner">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-mint-400">Recommended Action</div>
                          <h3 className="font-display text-base font-semibold text-white sm:text-lg">
                            Recommended action: Move <span className="text-aqua-300 font-extrabold">{DETECTED_WORKLOADS.find(w => w.id === activeWorkload)?.name || "your workload"}</span> from{" "}
                            <span className="text-slate-200 font-bold">{formatRegionName(result.current.provider, result.current.region_name)}</span> to{" "}
                            <span className="text-mint-300 font-bold bg-mint-500/10 px-2 py-0.5 rounded border border-mint-500/20">{formatRegionName(result.multicloud[0].provider, result.multicloud[0].region_name)}</span>
                          </h3>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Hero metrics */}
                  <div className="glass overflow-hidden rounded-2xl">
                    <div className="grid md:grid-cols-[auto_1fr_auto]">
                      <div className="flex items-center justify-center border-b border-white/5 p-8 md:border-b-0 md:border-r">
                        <ScoreRing score={result.current.sustainability_score} size={160} />
                      </div>
                      <div className="p-8">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-2xl font-bold text-white">{result.current.region_name}</h2>
                          <TierBadge tier={result.verification.footprint_tier} />
                        </div>
                        <p className="mt-1 text-slate-400">
                          {result.current.provider} · {result.current.score_label} · {result.current.latency_ms} ms latency
                        </p>
                        <p className="mt-2 font-mono text-xs text-aqua-400/80">
                          Energy {fp?.energy_tier} · {fp?.energy_basis}
                        </p>
                        {Object.keys(components).length > 0 && (
                          <div className="mt-4 max-w-xs">
                            <ScoreRadar components={components} />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 border-t border-white/5 md:border-l md:border-t-0">
                        {[
                          { label: "Water / mo", value: fp?.water_L_month.mid, unit: "L", color: "text-cyan-400" },
                          { label: "Carbon / mo", value: fp?.carbon_kg_month.mid, unit: "kg", color: "text-amber-400" },
                          { label: "Cost / mo", value: fp?.cost_usd_month, unit: "$", color: "text-violet-400", prefix: "$" },
                        ].map((m) => (
                          <div key={m.label} className="border-white/5 p-4 text-center [&:not(:last-child)]:border-r">
                            <div className={`font-display text-xl font-bold ${m.color}`}>
                              {m.prefix}{m.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
                          </div>
                        ))}
                        <div className="col-span-3 border-t border-white/5 bg-white/[0.02] py-2 text-center text-[10px] font-mono text-slate-400">
                          Modeled estimate for decision support
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Scope 3 & Offsets Metrics */}
                  {fp && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Lifecycle Carbon &amp; Offsets</h3>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Scope 3 Embodied / mo</div>
                            <div className={`font-display text-xl font-bold text-amber-500`}>
                              {fp.embodied_carbon_kg_month?.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Chip manufacturing &amp; logistics</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Carbon / mo</div>
                            <div className={`font-display text-xl font-bold text-red-400`}>
                              {fp.total_carbon_kg_month?.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Scope 2 + Scope 3 emissions</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Offset Cost / mo</div>
                            <div className={`font-display text-xl font-bold text-emerald-400`}>
                              ${fp.offset_cost_usd_month?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Direct Air Capture offset equivalent</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Tree Equivalence</div>
                            <div className={`font-display text-xl font-bold text-green-400`}>
                              {fp.tree_absorption_months?.toLocaleString(undefined, { maximumFractionDigits: 0 })} trees
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Mature tree-months absorption</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-display text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Lifecycle Water Footprint</h3>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Operational Water / mo</div>
                            <div className={`font-display text-xl font-bold text-cyan-400`}>
                              {fp.water_L_month.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Facility cooling evaporation</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Scope 3 Embodied Water / mo</div>
                            <div className={`font-display text-xl font-bold text-sky-400`}>
                              {fp.embodied_water_L_month?.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                            </div>
                            <div className="mt-1 text-xs text-slate-500">GPU &amp; server manufacturing</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Lifecycle Water / mo</div>
                            <div className={`font-display text-xl font-bold text-blue-400`}>
                              {fp.total_water_L_month?.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Scope 2 + Scope 3 water footprint</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Domestic Equivalency</div>
                            <div className={`font-display text-xl font-bold text-teal-400`}>
                              {(fp.total_water_L_month ? fp.total_water_L_month.mid / 9000 : 0).toFixed(1)} households
                            </div>
                            <div className="mt-1 text-xs text-slate-500 font-mono">Avg. household footprint (~9kL)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footprint breakdown */}
                  {fp && (
                    <div className="glass rounded-2xl p-6">
                      <h3 className="font-display font-bold text-white">Footprint breakdown</h3>
                      <div className="mt-4">
                        <FootprintBars water={fp.water_L_month.mid} carbon={fp.carbon_kg_month.mid} cost={fp.cost_usd_month} />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span>{fp.gpus} GPUs · PUE {fp.pue ?? "—"} · WUE {fp.wue ?? "—"}</span>
                        {liveTelemetry && (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            LIVE DCIM CONNECTED
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Alternatives */}
                  {result.multicloud.length > 0 && (
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">Greener alternatives</h3>
                      <p className="mt-1 text-sm text-slate-500">Cross-cloud regions within your latency budget</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {result.multicloud.map((m, i) => (
                          <motion.div
                            key={`${m.provider}-${m.region_code}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`glass rounded-xl p-5 ${i === 0 ? "border-mint-500/30 bg-mint-500/5" : ""}`}
                          >
                            {i === 0 && (
                              <span className="mb-2 inline-block rounded-full bg-mint-500/20 px-2 py-0.5 text-[10px] font-bold text-mint-400">
                                BEST PICK
                              </span>
                            )}
                            <div className="font-semibold text-white">{m.region_name}</div>
                            <div className="font-mono text-xs text-slate-500">{m.provider} · {m.region_code}</div>
                            <div className="mt-4 flex items-end justify-between">
                              <div>
                                <div className="font-display text-2xl font-bold text-white">{m.sustainability_score}</div>
                                <div className="text-[10px] text-slate-500">score</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-mint-400">-{m.carbon_savings_pct}%</div>
                                <div className="text-[10px] text-slate-500">carbon · {m.latency_ms}ms</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* IaC Code Exporters */}
                  {result && (
                    <div className="glass rounded-2xl p-6">
                      <h3 className="font-display font-bold text-white">Actionable Infrastructure Exporters</h3>
                      <p className="mt-1 text-sm text-slate-500">Export carbon-aware orchestrator configuration code targeting cleaner regions.</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="font-mono text-xs text-slate-400 uppercase">Kubernetes Affinity Scheduler Policy</h4>
                          <button
                            onClick={async () => {
                              const cleanRegions = result.multicloud.map(m => m.region_code).join(",") || result.current.region_code;
                              const d = await fetch(`/api/export/kubernetes?regions=${cleanRegions}`).then(r => r.json());
                              const blob = new Blob([d.yaml], { type: "text/yaml" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "kubernetes-carbon-affinity.yaml";
                              a.click();
                            }}
                            className="btn-glow mt-2 w-full text-xs"
                          >
                            Download Kubernetes YAML
                          </button>
                        </div>
                        <div>
                          <h4 className="font-mono text-xs text-slate-400 uppercase">Terraform Provider Config (Clean Region)</h4>
                          <button
                            onClick={async () => {
                              const best = result.multicloud[0] || result.current;
                              const d = await fetch(`/api/export/terraform?provider=${best.provider}&region=${best.region_code}&score=${best.sustainability_score}`).then(r => r.json());
                              const blob = new Blob([d.tf], { type: "text/plain" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "main-provider.tf";
                              a.click();
                            }}
                            className="btn-glow mt-2 w-full text-xs"
                          >
                            Download Terraform Configuration
                          </button>
                        </div>
                        <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
                          <h4 className="font-mono text-xs text-slate-400 uppercase">GitHub Actions Gated Deployment Policy</h4>
                          <button
                            onClick={async () => {
                              const best = result.multicloud[0] || result.current;
                              const workflowYaml = `# HydraWatch Carbon & Water Gate CI Pipeline
name: Sustainability Gated Deployment
on:
  pull_request:
    branches: [ main ]
jobs:
  sustainability-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: HydraWatch Sustainability Gating
        uses: ./actions/deploy-gate
        with:
          provider: '${best.provider}'
          region: '${best.region_code}'
          min_score: '50.0'
          min_tier: 'V1'
          api_key: '\${{ secrets.HYDRAWATCH_API_KEY }}'
          api_url: 'https://api.hydrawatch.com'
`;
                              const blob = new Blob([workflowYaml], { type: "text/yaml" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "sustainability-gate.yml";
                              a.click();
                            }}
                            className="btn-glow mt-2 w-full text-xs"
                          >
                            Download GitHub Actions YAML
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sourcing & References Atlas */}
        <div className="mt-12">
          <button
            type="button"
            onClick={() => setRefOpen(!refOpen)}
            className="flex w-full items-center justify-between border-t border-white/10 pt-6 text-left transition hover:text-aqua-300"
          >
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-aqua-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Sourcing &amp; References Atlas
              </h3>
              <p className="text-xs text-slate-500">Scientific database sources, mathematical footprint methodologies, and carbon/water data baselines</p>
            </div>
            <span className="text-slate-400">
              {refOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </span>
          </button>

          <AnimatePresence>
            {refOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="glass rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      Water Basin Risk &amp; Depletion
                    </h4>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Local water stress indexes are sourced dynamically from the <strong>World Resources Institute (WRI) Aqueduct Water Risk Atlas 4.0</strong>. Baseline water stress measures the ratio of total water withdrawals to available renewable surface and groundwater supplies. Basins with scores above 3.0 (high/extremely high) trigger proactive warnings.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: WRI Aqueduct 4.0, Global Hydrological Model (PCR-GLOBWB).
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      WUE &amp; Cooling Technology Models
                    </h4>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Water Usage Effectiveness (WUE) factors are compiled from <strong>Cloud Provider ESG Reports (Amazon, Google, Microsoft 2023)</strong> and customized by regional cooling system deployments. Evaporative cooling, direct-expansion, and closed-loop liquid systems are modeled with uncertainty bands corresponding to seasonal PUE/WUE efficiency fluctuations.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: Provider Sustainability Briefs &amp; annual ESG updates.
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Grid Carbon Intensity Factors
                    </h4>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Operational Scope 2 emissions factors represent real-time and historical grid marginal fuel mixes. We query <strong>Electricity Maps API</strong> and reference standard <strong>IEA Grid Emission Factors</strong> databases. Carbon calculations account for transmission losses and regional grid interconnect dependencies.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: Electricity Maps &amp; IEA Global Grid intensity averages (2023/24).
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      Semiconductor Embodied Lifecycle (Scope 3)
                    </h4>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Scope 3 embodied values calculate carbon and water consumed during semiconductor fabrication, lithography, packaging, and logistics. Our baselines map to <strong>TSMC Corporate Social Responsibility (CSR) reports</strong>, <strong>IEEE semiconductor lifecycle assessments</strong>, and hardware spec sheets (e.g. A100 vs H100 manufacturing footprints).
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: TSMC ESG wafer fab metrics &amp; IEEE lifecycle databases.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
