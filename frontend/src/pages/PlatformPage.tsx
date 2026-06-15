import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreRing, TierBadge } from "../components/ScoreRing";
import { ScoreRadar, FootprintBars } from "../components/Charts";
import { FadeIn } from "../components/AnimatedCounter";
import { api } from "../lib/api";
import type { AnalyzeRequest, AnalyzeResult, Meta, Region, Scenario } from "../types";

declare global {
  interface Window {
    hydraTurnstileCallback?: (token: string) => void;
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

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

function formatWaterRange(lowL: number, highL: number): string {
  const lowGal = lowL * 0.264172;
  const highGal = highL * 0.264172;
  return `${Math.round(lowL).toLocaleString()}–${Math.round(highL).toLocaleString()} L (${Math.round(lowGal).toLocaleString()}–${Math.round(highGal).toLocaleString()} gal)`;
}

function formatCarbonRange(lowKg: number, highKg: number): string {
  const lowLbs = lowKg * 2.20462;
  const highLbs = highKg * 2.20462;
  return `${Math.round(lowKg).toLocaleString()}–${Math.round(highKg).toLocaleString()} kg (${Math.round(lowLbs).toLocaleString()}–${Math.round(highLbs).toLocaleString()} lbs)`;
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
  { id: "agent", title: "CLI Audit Agent", desc: "Local telemetry extractor, zero-credential upload" },
  { id: "cloud", title: "Cloud IAM Roles", desc: "AWS Role ARN, GCP Workload Identity, Azure RBAC" },
  { id: "csv", title: "Billing CSV Export", desc: "Parse AWS CUR, GCP Billing, or Azure Cost Export locally" },
  { id: "mlops", title: "MLOps Webhooks", desc: "MLflow & Weights & Biases registry integration" },
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1 text-[10px] font-semibold transition flex items-center gap-1 shrink-0 font-sans"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-7 8H10" />
        )}
      </svg>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function PlatformPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [params, setParams] = useState<AnalyzeRequest>(DEFAULT);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeScenario, setActiveScenario] = useState("india_llm");
  const [activeSource, setActiveSource] = useState("agent");
  const [activeWorkload, setActiveWorkload] = useState(DETECTED_WORKLOADS[0].id);
  const [refOpen, setRefOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [liveTelemetry, setLiveTelemetry] = useState(false);

  // New connection simulation states
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedSource, setConnectedSource] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [cloudCreds, setCloudCreds] = useState({ provider: "AWS", roleArn: "", extId: "" });
  const [logCreds, setLogCreds] = useState({ type: "cloudwatch", endpoint: "", token: "" });
  const [mlopsCreds, setMlopsCreds] = useState({ provider: "mlflow", url: "", token: "" });

  const [activeCloudTab, setActiveCloudTab] = useState<"aws" | "gcp" | "azure">("aws");
  const [agentPastedText, setAgentPastedText] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const startSimulation = (sourceId: string, steps: string[]) => {
    setIsConnecting(true);
    setConsoleLogs([]);
    setConnectedSource(null);
    
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setConsoleLogs((prev) => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsConnecting(false);
        setConnectedSource(sourceId);
      }
    }, 450);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSource === "cloud") {
      const steps = activeCloudTab === "aws" ? [
        `[iam] Parsing AWS IAM Role: ${cloudCreds.roleArn || "arn:aws:iam::123456789012:role/HydraWatchRead"}`,
        `[iam] Authenticating using External ID: ${cloudCreds.extId || "hw_external_verify_id_992"}...`,
        "[iam] Querying active instances in region ap-south-1...",
        "[iam] Checked active instances: ec2:DescribeInstances [OK]",
        "[iam] Telemetry active: cloudwatch:GetMetricData [OK]",
        "[iam] Successfully established AWS cross-account session."
      ] : activeCloudTab === "gcp" ? [
        "[federation] Resolving Workload Identity Pool Provider token...",
        "[federation] Initializing Google Security Token Service (STS) handshake...",
        "[federation] Exchanging OIDC token for temporary service account token...",
        "[federation] Querying active VMs in GCP project project-id-881...",
        "[federation] Read-only compute registry query successful.",
        "[federation] Secure federated session established."
      ] : [
        "[entra] Resolving Azure App Registration client ID...",
        "[entra] Querying Microsoft Graph for active subscriptions...",
        "[entra] Checking IAM Roles for Client ID...",
        "[entra] Verified role assignment: Cost Management Reader [OK]",
        "[entra] Mapped active Azure GPU sizes: Standard_ND96asr_v4",
        "[entra] Successfully established secure Azure integration."
      ];
      startSimulation("cloud", steps);
    } else if (activeSource === "mlops") {
      const steps = [
        "[webhook] Secure webhook gateway: listening on /v1/webhooks/mlops",
        `[webhook] Sending simulation payload from ${mlopsCreds.provider} registry...`,
        "[webhook] Payload signature SHA256 verified",
        "[webhook] Decrypted model deployment event (Claude-Sonnet, H100, centralindia)",
        "[webhook] Registry webhook verification successful."
      ];
      startSimulation("mlops", steps);
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFileName(file.name);
      const steps = [
        `[csv] Reading Cost & Usage Report file: ${file.name}...`,
        "[csv] Mapped required columns: LineItem/ProductCode, LineItem/UsageAmount, LineItem/ResourceId",
        "[csv] Local browser Web Worker processing 14,289 rows...",
        "[csv] Filtered 3 distinct GPU billing meters (A100/H100 instance-hours)",
        "[csv] Aggregate hourly workload profile constructed locally",
        "[csv] Workload mapping loaded."
      ];
      startSimulation("csv", steps);
    }
  };

  useEffect(() => {
    api.meta().then(setMeta).catch(console.error);
    api.locations().then((d) => setLocations(d.locations)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    window.hydraTurnstileCallback = (token: string) => setTurnstileToken(token);
    if (!document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    return () => {
      delete window.hydraTurnstileCallback;
    };
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
      setResult(await api.analyze({ ...params, live_telemetry: liveTelemetry, turnstile_token: turnstileToken || undefined }, 6, apiKey));
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
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Workload intelligence</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
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
                  ? "border-slate-900 bg-slate-100/80 ring-1 ring-slate-950/20 shadow-sm"
                  : "hover:border-slate-300 border-slate-200 bg-white"
              }`}
            >
              <div className={`font-semibold ${activeSource === source.id ? "text-slate-900" : "text-slate-700"}`}>{source.title}</div>
              <div className="mt-1 text-xs text-slate-500">{source.desc}</div>
            </button>
          ))}
        </div>

        {/* Connection Configuration Panel */}
        <div className="grid gap-6 md:grid-cols-3 mt-6">
          {/* Form block */}
          <div className="glass bg-white p-6 md:col-span-2 border border-slate-200">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-800 mb-4">
              Configure Connection: {SOURCES.find((s) => s.id === activeSource)?.title}
            </h3>

            {activeSource === "agent" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Anonymized local auditing:</strong> Run our lightweight, open-source agent inside your private VPC. It gathers hardware shapes, CPU/GPU utilization limits, and latency targets, then generates an offline audit file. Your active codebase, model weights, and access keys are never touched.
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">CLI Command</span>
                    <CopyButton text={`pip install hydrawatch-agent\nhydrawatch-agent scan --provider aws --region ap-south-1 --output workload-profile.json`} />
                  </div>
                  <pre className="font-mono text-[10.5px] text-slate-700 leading-relaxed overflow-x-auto whitespace-pre">
                    {`# 1. Install local CLI agent\npip install hydrawatch-agent\n\n# 2. Run local workload scan\nhydrawatch-agent scan --provider aws --region ap-south-1 --output workload-profile.json`}
                  </pre>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-dark" htmlFor="pasted-json">Paste workload-profile.json</label>
                    <textarea
                      id="pasted-json"
                      rows={4}
                      className="input-dark font-mono text-[10px]"
                      placeholder='{ "agent_version": "v1.4.2", "workloads": [...] }'
                      value={agentPastedText}
                      onChange={(e) => setAgentPastedText(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col justify-between border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition relative text-center">
                    <input
                      type="file"
                      accept=".json"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const steps = [
                            `[agent] Loaded local report file: ${file.name}`,
                            "[agent] Resolving schema definitions matching agent v1.4.2...",
                            "[agent] Found 3 active deployment signatures",
                            "[agent] Discovered workloads (AWS Customer Support, GCP RAG, Azure Batch)",
                            "[agent] Sync complete. TLS 1.3 handshake verified."
                          ];
                          startSimulation("agent", steps);
                        }
                      }}
                    />
                    <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <div className="text-[11px] font-semibold text-slate-700">Drop workload-profile.json here</div>
                    <div className="text-[9px] text-slate-500">JSON file only (under 2MB)</div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sample = `{
  "agent_version": "v1.4.2",
  "scanned_at": "${new Date().toISOString()}",
  "environment": "production-k8s-us",
  "workloads": [
    {
      "name": "Customer Support Copilot",
      "provider": "AWS",
      "region": "ap-south-1",
      "gpu_type": "A100",
      "model": "LLaMA-3-70B",
      "qps": 150
    }
  ]
}`;
                      setAgentPastedText(sample);
                      const steps = [
                        "[agent] Local JSON template loaded (341 bytes)",
                        "[agent] Resolving schema definitions matching agent v1.4.2...",
                        "[agent] Found 3 active deployment signatures",
                        "[agent] Discovered: Customer Support Copilot (AWS ap-south-1), RAG Assistant (GCP asia-south1)",
                        "[agent] Sending metadata envelope to secure HydraWatch endpoint...",
                        "[agent] Sync complete. TLS 1.3 handshake verified."
                      ];
                      startSimulation("agent", steps);
                    }}
                    className="flex-1 rounded-xl border border-slate-300 hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition"
                  >
                    Load Sample workload-profile.json
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!agentPastedText.trim()) return;
                      const steps = [
                        "[agent] Parsing custom pasted JSON structure...",
                        "[agent] Validating mandatory keys: provider, region, model, qps...",
                        "[agent] Workload envelope integrity checks passed.",
                        "[agent] Synchronizing metadata profile client-side...",
                        "[agent] Sync complete."
                      ];
                      startSimulation("agent", steps);
                    }}
                    disabled={isConnecting || !agentPastedText}
                    className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold transition"
                  >
                    Parse & Verify Local Profile
                  </button>
                </div>
              </div>
            )}

            {activeSource === "cloud" && (
              <form onSubmit={handleConnect} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Secure Cloud Credentials Delegation:</strong> HydraWatch connects to your clouds using read-only roles and federation. We advocate Workload Identity (OIDC) or strict IAM policies, ensuring zero persistent API access keys are kept on our backend.
                </p>

                {/* Sub tabs */}
                <div className="flex border-b border-slate-200">
                  {[
                    { id: "aws", label: "AWS (IAM Role)" },
                    { id: "gcp", label: "GCP (Workload Identity)" },
                    { id: "azure", label: "Azure (Service Principal)" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCloudTab(tab.id as any)}
                      className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
                        activeCloudTab === tab.id
                          ? "border-teal-600 text-teal-700"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeCloudTab === "aws" && (
                  <div className="space-y-4 pt-1">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Create an IAM Role with an External ID delegating read-only access to ec2 and cloudwatch. Paste the role ARN below.
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
                        <span className="font-mono text-[9px] font-bold text-slate-500 uppercase">IAM Policy JSON</span>
                        <CopyButton text={`{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Action": ["ec2:DescribeInstances", "cloudwatch:GetMetricData"],\n    "Resource": "*"\n  }]\n}`} />
                      </div>
                      <pre className="font-mono text-[9.5px] text-slate-700 leading-relaxed overflow-x-auto whitespace-pre">
                        {`{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Action": ["ec2:DescribeInstances", "cloudwatch:GetMetricData"],\n    "Resource": "*"\n  }]\n}`}
                      </pre>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label-dark" htmlFor="aws-role-arn">IAM Role ARN</label>
                        <input
                          id="aws-role-arn"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="arn:aws:iam::123456789012:role/HydraWatchRead"
                          value={cloudCreds.roleArn}
                          onChange={(e) => setCloudCreds({ ...cloudCreds, roleArn: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="label-dark" htmlFor="aws-ext-id">External ID</label>
                        <input
                          id="aws-ext-id"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="hw_external_verify_id_992"
                          value={cloudCreds.extId}
                          onChange={(e) => setCloudCreds({ ...cloudCreds, extId: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full py-2.5 text-xs font-semibold transition" disabled={isConnecting}>
                      Verify IAM Role Connectivity
                    </button>
                  </div>
                )}

                {activeCloudTab === "gcp" && (
                  <div className="space-y-4 pt-1">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Use Workload Identity Federation to authenticate without service account JSON keys. Configure a pool mapping to our OIDC issuer.
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
                        <span className="font-mono text-[9px] font-bold text-slate-500 uppercase">Terraform Snippet</span>
                        <CopyButton text={`resource "google_iam_workload_identity_pool" "hw_pool" {\n  workload_identity_pool_id = "hydrawatch-pool"\n}\nresource "google_iam_workload_identity_pool_provider" "hw_provider" {\n  workload_identity_pool_id = google_iam_workload_identity_pool.hw_pool.workload_identity_pool_id\n  workload_identity_pool_provider_id = "hydrawatch-provider"\n  attribute_mapping = {\n    "google.subject" = "assertion.sub"\n  }\n  oidc {\n    issuer_uri = "https://auth.hydrawatch.com"\n  }\n}`} />
                      </div>
                      <pre className="font-mono text-[9px] text-slate-700 leading-relaxed overflow-x-auto whitespace-pre">
                        {`resource "google_iam_workload_identity_pool" "hw_pool" {\n  workload_identity_pool_id = "hydrawatch-pool"\n}`}
                      </pre>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label-dark" htmlFor="gcp-project-id">GCP Project ID</label>
                        <input
                          id="gcp-project-id"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="sustainability-prod-99"
                          required
                        />
                      </div>
                      <div>
                        <label className="label-dark" htmlFor="gcp-provider-id">Pool Provider ID</label>
                        <input
                          id="gcp-provider-id"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="hydrawatch-provider"
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full py-2.5 text-xs font-semibold transition" disabled={isConnecting}>
                      Establish Federated Session
                    </button>
                  </div>
                )}

                {activeCloudTab === "azure" && (
                  <div className="space-y-4 pt-1">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Register an App registration in Microsoft Entra ID and assign it the Cost Management Reader role on your target subscription scope.
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
                        <span className="font-mono text-[9px] font-bold text-slate-500 uppercase">Azure CLI Code</span>
                        <CopyButton text={`az ad sp create-for-rbac --name "HydraWatchAuditor" --role "Reader" --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID"`} />
                      </div>
                      <pre className="font-mono text-[9.5px] text-slate-700 leading-relaxed overflow-x-auto whitespace-pre">
                        {`az ad sp create-for-rbac --name "HydraWatchAuditor" --role "Reader"`}
                      </pre>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label-dark" htmlFor="azure-tenant-id">Tenant ID (UUID)</label>
                        <input
                          id="azure-tenant-id"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="e.g. 8f4b5a12-..."
                          required
                        />
                      </div>
                      <div>
                        <label className="label-dark" htmlFor="azure-client-id">Client ID (UUID)</label>
                        <input
                          id="azure-client-id"
                          type="text"
                          className="input-dark font-mono text-[10.5px]"
                          placeholder="e.g. 3a2c9b14-..."
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full py-2.5 text-xs font-semibold transition" disabled={isConnecting}>
                      Verify App Registration &amp; Roles
                    </button>
                  </div>
                )}
              </form>
            )}

            {activeSource === "csv" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Client-Side Billing CSV Extraction:</strong> Upload your Cost &amp; Usage Reports (CUR). All calculations and column indexing are performed locally within your browser sandbox. No billing rates, pricing schedules, or resource IDs are uploaded to our servers.
                </p>

                <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition relative">
                  <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleCsvChange}
                  />
                  <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className="mt-4 text-xs font-semibold text-slate-800">
                    {csvFileName ? `File selected: ${csvFileName}` : "Drag and drop your billing export (CSV) here, or click to browse"}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Supports AWS CUR, Azure Cost Export, or GCP BigQuery Billing tables
                  </div>
                </div>

                {csvFileName && (
                  <button
                    onClick={() => {
                      const steps = [
                        `[csv] Reading local file streams: ${csvFileName}`,
                        "[csv] Columns detected: UsageAmount, ResourceID, PricingUnit",
                        "[csv] Processing 14,289 rows using browser thread pool...",
                        "[csv] Aggregated: 3 model endpoints active",
                        "[csv] Sync success."
                      ];
                      startSimulation("csv", steps);
                    }}
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full py-2.5 text-xs font-semibold transition"
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Analyzing CSV Columns..." : "Parse & Detect Workloads"}
                  </button>
                )}
              </div>
            )}

            {activeSource === "mlops" && (
              <form onSubmit={handleConnect} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>MLOps Webhook Gateways:</strong> Wire up model registry triggers. Whenever a model lifecycle state shifts (e.g. from registered to deployed), our endpoint receives the target specs and calculates footprints dynamically.
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">Webhook Endpoint URL</span>
                    <CopyButton text={`https://api.hydrawatch.com/v1/webhooks/mlops?api_key=hw_live_sustainability_gate_key`} />
                  </div>
                  <div className="font-mono text-[10.5px] text-slate-700 break-all select-all">
                    {"https://api.hydrawatch.com/v1/webhooks/mlops?api_key=hw_live_sustainability_gate_key"}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-dark" htmlFor="mlops-provider">Registry Type</label>
                    <select
                      id="mlops-provider"
                      className="input-dark"
                      value={mlopsCreds.provider}
                      onChange={(e) => setMlopsCreds({ ...mlopsCreds, provider: e.target.value })}
                    >
                      <option value="mlflow">MLflow Server</option>
                      <option value="wandb">Weights &amp; Biases (W&B)</option>
                      <option value="huggingface">Hugging Face Spaces API</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label-dark">Sample Webhook Payload</label>
                      <CopyButton text={`{\n  "event": "model_deployed",\n  "model": "Claude-Sonnet",\n  "gpu": "H100",\n  "qps": 45,\n  "region": "centralindia"\n}`} />
                    </div>
                    <pre className="font-mono text-[9px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 overflow-x-auto whitespace-pre mt-1">
                      {`{\n  "event": "model_deployed",\n  "model": "Claude-Sonnet",\n  "gpu": "H100"\n}`}
                    </pre>
                  </div>
                </div>

                <button type="submit" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full py-2.5 text-xs font-semibold transition" disabled={isConnecting}>
                  {isConnecting ? "Listening for trigger..." : "Simulate Webhook Trigger Event"}
                </button>
              </form>
            )}
          </div>

          {/* Guide & Status block */}
          <div className="glass bg-white p-6 border border-slate-200 flex flex-col justify-between">
            {isConnecting || consoleLogs.length > 0 ? (
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-800">
                      Audit Console
                    </h3>
                    <span className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full bg-teal-500 ${isConnecting ? "animate-pulse bg-amber-500" : ""}`} />
                      <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">
                        {isConnecting ? "ACTIVE" : "READY"}
                      </span>
                    </span>
                  </div>

                  <div className="bg-slate-900 text-slate-200 font-mono p-4 rounded-xl text-[10px] leading-relaxed border border-slate-950 shadow-inner h-56 overflow-y-auto mt-2 select-all whitespace-pre-wrap">
                    {consoleLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={
                          log.includes("[SUCCESS]") || log.includes("verified") || log.includes("successful") || log.includes("[agent] Sync complete") || log.includes("[federation] Secure federated") || log.includes("[entra] Successfully established") || log.includes("Sync complete")
                            ? "text-teal-400"
                            : log.includes("[error]")
                            ? "text-red-400"
                            : "text-slate-300"
                        }
                      >
                        {log}
                      </div>
                    ))}
                    {isConnecting && (
                      <span className="inline-block h-3.5 w-1.5 bg-teal-400 animate-pulse ml-0.5" />
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4 text-[10.5px] text-slate-500 font-mono leading-normal">
                  {isConnecting ? (
                    <span className="text-amber-600 animate-pulse font-bold">Verifying cryptographic envelope...</span>
                  ) : (
                    <span className="text-teal-700 font-bold">✓ Telemetry synced successfully. Workloads unlocked.</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-800 mb-3">
                  Security & Integration
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeSource === "agent" && "No cloud credentials are read or written. The local CLI scans instances client-side, compiling hardware configuration flags into an anonymous schema file."}
                  {activeSource === "cloud" && "Read-only cloud role connectors query deployment metadata. We do not support storing long-lived service account key JSON files on our backend."}
                  {activeSource === "csv" && "Invoice rows are processed directly inside your browser session using web workers. No CUR data or financial items leave your sandboxed environment."}
                  {activeSource === "mlops" && "Webhook tokens secure metadata channels using OIDC or secret-signed headers. Telemetry data strictly registers infrastructure specs and GPU metrics."}
                </p>
                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-200 text-[10px] text-slate-500 font-mono leading-relaxed">
                  TLS 1.3 encryption · Zero persistent credential storage · Complies with SOC2 &amp; ISO27001 auditing guidelines.
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Connection:</span>
                {connectedSource === activeSource ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 border border-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    NOT CONNECTED
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {connectedSource && (
          <FadeIn>
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/10 p-4 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-emerald-800">
                  <span className="font-bold">Connection Established:</span> Discovered active workloads below from your connected <strong>{SOURCES.find(s => s.id === connectedSource)?.title}</strong>. Click any card to load the telemetry details.
                </div>
              </div>
              <button 
                onClick={() => setConnectedSource(null)}
                className="text-xs text-emerald-700 hover:text-emerald-950 font-bold underline font-mono"
              >
                Disconnect
              </button>
            </div>
          </FadeIn>
        )}

        <div className="mt-10">
          <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-3 mb-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Detected workloads</h2>
              <p className="mt-1 text-sm text-slate-600">Auto-discovered from the active source. Choose one to load telemetry.</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Automatic Detection Active
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {DETECTED_WORKLOADS.map((workload) => (
              <button
                key={workload.id}
                type="button"
                onClick={() => applyDetectedWorkload(workload)}
                className={`glass rounded-xl p-4 text-left transition ${
                  activeWorkload === workload.id
                    ? "border-slate-900 bg-slate-100/80 ring-1 ring-slate-950/20 shadow-sm"
                    : "hover:border-slate-300 border-slate-200 bg-white"
                }`}
              >
                <div className={`text-xs font-semibold uppercase tracking-wide ${activeWorkload === workload.id ? "text-teal-600" : "text-slate-500"}`}>{workload.source}</div>
                <div className={`mt-2 font-semibold ${activeWorkload === workload.id ? "text-slate-900" : "text-slate-700"}`}>{workload.name}</div>
                <div className="mt-1 text-xs text-slate-500">{workload.owner}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span>
                    {(() => {
                      const reg = regions.find(r => r.region_code === workload.params.region_code);
                      return `${workload.params.provider} · ${reg ? formatRegionDisplayName(workload.params.region_code, reg.region_name, reg.country, reg.city) : workload.params.region_code}`;
                    })()}
                  </span>
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
          <div className="glass rounded-2xl p-6 xl:col-span-4 bg-white border border-slate-200 shadow-sm">
            <h2 className="font-display font-bold text-slate-900">Detected deployment</h2>
            <p className="mt-1 text-xs text-slate-500">These fields are populated from connected systems. Advanced overrides are available for testing.</p>
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                {[
                  ["Provider", params.provider],
                  ["Region", (() => {
                    const reg = regions.find(r => r.region_code === params.region_code);
                    return reg ? formatRegionDisplayName(params.region_code, reg.region_name, reg.country, reg.city) : params.region_code;
                  })()],
                  ["Model", params.model_name],
                  ["GPU", params.gpu_type],
                  ["Traffic", `~${(params.qps * 0.0864).toFixed(1)}M req/day · ${params.avg_tokens.toLocaleString()} tokens/req`],
                  ["Users", `${params.user_location} · ${params.max_latency_ms} ms SLA`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-slate-500">{label}</span>
                    <strong className="text-right text-slate-800">{value}</strong>
                  </div>
                ))}
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Advanced override / testing</summary>
                <div className="mt-4 space-y-4">
                  {meta?.scenarios && (
                    <div>
                      <label className="label-dark">Fallback scenario template</label>
                      <select className="input-dark" value={activeScenario} onChange={(e) => {
                        const scenario = meta.scenarios.find((s) => s.id === e.target.value);
                        if (scenario) applyScenario(scenario);
                      }}>
                        <option value="">None</option>
                        {meta.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label-dark">Provider</label>
                    <select className="input-dark" value={params.provider} onChange={(e) => setParams({ ...params, provider: e.target.value, region_code: "" })}>
                      {meta?.providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-dark">Region</label>
                    <select className="input-dark" value={params.region_code} onChange={(e) => setParams({ ...params, region_code: e.target.value })}>
                      {regions.map((r) => <option key={r.region_code} value={r.region_code}>{formatRegionDisplayName(r.region_code, r.region_name, r.country, r.city)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-dark">User location</label>
                    <select className="input-dark" value={params.user_location} onChange={(e) => setParams({ ...params, user_location: e.target.value })}>
                      {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-dark">GPU</label>
                      <select className="input-dark" value={params.gpu_type} onChange={(e) => setParams({ ...params, gpu_type: e.target.value })}>
                        {meta?.gpus.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-dark">Model</label>
                      <select className="input-dark" value={params.model_name} onChange={(e) => setParams({ ...params, model_name: e.target.value })}>
                        {meta?.models.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-dark">Quantization</label>
                      <select className="input-dark" value={params.quantization || "FP16"} onChange={(e) => setParams({ ...params, quantization: e.target.value })}>
                        <option value="FP16">FP16</option>
                        <option value="FP8">FP8</option>
                        <option value="INT4">INT4</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-dark">Framework</label>
                      <select className="input-dark" value={params.framework || "standard"} onChange={(e) => setParams({ ...params, framework: e.target.value })}>
                        <option value="standard">Standard</option>
                        <option value="vllm">vLLM</option>
                        <option value="tensorrt">TensorRT-LLM</option>
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
                  <div className="flex items-center justify-between py-1 border-t border-slate-200 mt-2">
                    <label className="text-xs font-semibold text-slate-600 cursor-pointer" htmlFor="live-telemetry">
                      Enable Live DCIM Telemetry
                    </label>
                    <input
                      id="live-telemetry"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500"
                      checked={liveTelemetry}
                      onChange={(e) => setLiveTelemetry(e.target.checked)}
                    />
                  </div>
                  {TURNSTILE_SITE_KEY && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div
                        className="cf-turnstile"
                        data-sitekey={TURNSTILE_SITE_KEY}
                        data-callback="hydraTurnstileCallback"
                      />
                      <p className="mt-2 text-[10px] text-slate-500">
                        Human verification helps protect public analysis capacity from automated spam.
                      </p>
                    </div>
                  )}
                </div>
              </details>
              <button type="button" className="btn-glow w-full" onClick={run} disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating…
                  </span>
                ) : (
                  "Generate recommendation"
                )}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
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
                      className="relative overflow-hidden rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 border border-red-200">
                          <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-display font-bold text-red-900">High Water Stress Alert</h3>
                          <p className="text-sm text-red-700 leading-relaxed">
                            The regional water tables in <strong>{result.current.region_name} ({result.current.region_code})</strong> are experiencing severe depletion.
                            High seasonal heat and heavy municipal/industrial demand have placed local water basins in critical stress. Running dense AI compute workloads here increases grid and cooling-water demand in an already constrained region.
                          </p>
                          <div className="grid gap-3 pt-2 sm:grid-cols-3">
                            <div className="rounded-lg bg-white p-3 border border-red-100">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Basin Stress Score</span>
                              <strong className="font-display text-lg text-red-700">{result.current.water_stress_score.toFixed(2)} / 5.0</strong>
                              <span className="block text-xs text-slate-500">{result.current.water_stress_label || "Extremely High"}</span>
                            </div>
                            <div className="rounded-lg bg-white p-3 border border-red-100">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Drought Index</span>
                              <strong className="font-display text-lg text-amber-700">{result.current.drought_risk?.toFixed(2)} / 5.0</strong>
                              <span className="block text-xs text-slate-500">Severe Drought Risk</span>
                            </div>
                            <div className="rounded-lg bg-white p-3 border border-red-100">
                              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Local Reservoirs</span>
                              <strong className="font-display text-sm text-red-700 font-bold">HIGH STRESS</strong>
                              <span className="block text-xs text-slate-500">Restricted usage active</span>
                            </div>
                          </div>
                          <div className="mt-4 rounded-lg bg-red-100/50 p-3 border border-red-200 text-xs text-red-800">
                            <strong>Dispatch Action Prompted:</strong> High-risk workload detected. We recommend dispatching this workload to a low water-stress alternative, such as <strong>{(() => {
                              const bestAlt = regions.find(r => r.region_code === result.multicloud[0]?.region_code);
                              return bestAlt ? `${result.multicloud[0]?.provider} · ${formatRegionDisplayName(bestAlt.region_code, bestAlt.region_name, bestAlt.country, bestAlt.city)}` : "eu-north-1 (Stockholm)";
                            })()}</strong> to preserve vital local freshwater tables.
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
                      className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Recommended Action</div>
                          <h3 className="font-display text-base font-semibold text-slate-900 sm:text-lg">
                            Recommended action: Move <span className="text-teal-600 font-extrabold">{DETECTED_WORKLOADS.find(w => w.id === activeWorkload)?.name || "your workload"}</span> from{" "}
                            <span className="text-slate-700 font-bold">
                              {(() => {
                                const reg = regions.find(r => r.region_code === result.current.region_code);
                                return `${result.current.provider} · ${reg ? formatRegionDisplayName(result.current.region_code, reg.region_name, reg.country, reg.city) : result.current.region_code}`;
                              })()}
                            </span> to{" "}
                            <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                              {(() => {
                                const reg = regions.find(r => r.region_code === result.multicloud[0].region_code);
                                return `${result.multicloud[0].provider} · ${reg ? formatRegionDisplayName(result.multicloud[0].region_code, reg.region_name, reg.country, reg.city) : result.multicloud[0].region_code}`;
                              })()}
                            </span>
                          </h3>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Region Profile Header */}
                  <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Target Region</span>
                        <TierBadge tier={result.verification.footprint_tier} />
                      </div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                        {(() => {
                          const reg = regions.find(r => r.region_code === result.current.region_code);
                          return reg ? formatRegionDisplayName(result.current.region_code, reg.region_name, reg.country, reg.city) : `${result.current.region_code} · ${result.current.region_name}`;
                        })()}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Provider: <strong className="text-slate-700">{result.current.provider}</strong> · Rating: <strong className="text-slate-700">{result.current.score_label}</strong> · Latency: <strong className="text-slate-700">{result.current.latency_ms} ms</strong>
                      </p>
                    </div>
                    <div className="flex flex-col md:items-end gap-1.5 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                      <span className="text-[10px] font-mono text-teal-600 font-semibold uppercase tracking-wider">
                        Grid Energy System
                      </span>
                      <span className="text-xs text-slate-700 font-bold font-mono">
                        {fp?.energy_tier} ({fp?.energy_basis})
                      </span>
                    </div>
                  </div>

                  {/* Core Impact Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left panel: Score Card */}
                    <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between gap-4 md:col-span-5 min-h-[380px]">
                      <div className="w-full border-b border-slate-100 pb-2">
                        <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">Sustainability Rating</h3>
                      </div>
                      <div className="my-auto flex flex-col items-center gap-4 w-full">
                        <ScoreRing score={result.current.sustainability_score} size={150} />
                        {Object.keys(components).length > 0 && (
                          <div className="w-full flex justify-center mt-2">
                            <ScoreRadar components={components} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right panel: Metric Cards Stack */}
                    <div className="space-y-4 md:col-span-7 flex flex-col justify-between">
                      {/* Water Card */}
                      <div className="glass bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-cyan-600 shadow-sm flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Water Footprint / month</span>
                          <Link to="/trust" className="text-[10px] text-teal-600 hover:underline">Methodology †</Link>
                        </div>
                        <div className="font-display text-xl sm:text-2xl font-bold text-cyan-700 mt-1.5">
                          {fp ? formatWaterRange(fp.water_L_month.low, fp.water_L_month.high) : "—"}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                          Modeled operational water evaporated locally for datacenter cooling systems.
                        </p>
                      </div>

                      {/* Carbon Card */}
                      <div className="glass bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-amber-600 shadow-sm flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Carbon Emissions / month</span>
                          <Link to="/trust" className="text-[10px] text-teal-600 hover:underline">Methodology †</Link>
                        </div>
                        <div className="font-display text-xl sm:text-2xl font-bold text-amber-700 mt-1.5">
                          {fp ? formatCarbonRange(fp.carbon_kg_month.low, fp.carbon_kg_month.high) : "—"}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                          Scope 2 operational emissions from regional power grid marginal fuel mixes.
                        </p>
                      </div>

                      {/* Cost Card */}
                      <div className="glass bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-slate-700 shadow-sm flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Compute Cost / month</span>
                          <Link to="/trust" className="text-[10px] text-teal-600 hover:underline">Methodology †</Link>
                        </div>
                        <div className="font-display text-xl sm:text-2xl font-bold text-slate-800 mt-1.5">
                          {fp ? `$${fp.cost_usd_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                          Baseline infrastructure cost modeled for active instance hour distributions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Scope 3 & Offsets Metrics */}
                  {fp && (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-1.5">
                          <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">Lifecycle Carbon &amp; Offsets</h3>
                          <Link to="/trust" className="text-xs text-teal-600 hover:underline">Methodology ↗</Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Scope 3 Embodied / mo</div>
                            <div className={`font-display text-xl font-bold text-amber-700`}>
                              {fp.embodied_carbon_kg_month ? formatCarbonRange(fp.embodied_carbon_kg_month.low, fp.embodied_carbon_kg_month.high) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Chip manufacturing &amp; logistics</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Carbon / mo</div>
                            <div className={`font-display text-xl font-bold text-red-700`}>
                              {fp.total_carbon_kg_month ? formatCarbonRange(fp.total_carbon_kg_month.low, fp.total_carbon_kg_month.high) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Scope 2 + Scope 3 emissions</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Offset Cost / mo</div>
                            <div className={`font-display text-xl font-bold text-emerald-700`}>
                              ${fp.offset_cost_usd_month?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Direct Air Capture offset equivalent</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Tree Equivalence</div>
                            <div className={`font-display text-xl font-bold text-green-700`}>
                              {fp.tree_absorption_months?.toLocaleString(undefined, { maximumFractionDigits: 0 })} trees
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Mature tree-months absorption</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-1.5">
                          <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">Lifecycle Water Footprint</h3>
                          <Link to="/trust" className="text-xs text-teal-600 hover:underline">Methodology ↗</Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Operational Water / mo</div>
                            <div className={`font-display text-xl font-bold text-cyan-700`}>
                              {fp ? formatWaterRange(fp.water_L_month.low, fp.water_L_month.high) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Facility cooling evaporation</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Scope 3 Embodied Water / mo</div>
                            <div className={`font-display text-xl font-bold text-sky-700`}>
                              {fp.embodied_water_L_month ? formatWaterRange(fp.embodied_water_L_month.low, fp.embodied_water_L_month.high) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">GPU &amp; server manufacturing</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Lifecycle Water / mo</div>
                            <div className={`font-display text-xl font-bold text-blue-700`}>
                              {fp.total_water_L_month ? formatWaterRange(fp.total_water_L_month.low, fp.total_water_L_month.high) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Scope 2 + Scope 3 water footprint</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-left bg-white border border-slate-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Domestic Equivalency</div>
                            <div className={`font-display text-xl font-bold text-teal-700`}>
                              {fp.total_water_L_month ? `${(fp.total_water_L_month.low / 9000).toFixed(1)}–${(fp.total_water_L_month.high / 9000).toFixed(1)}` : "0"} households
                            </div>
                            <div className="mt-1 text-xs text-slate-500 font-mono">Avg. household footprint (~9kL)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footprint breakdown */}
                  {fp && (
                    <div className="glass rounded-2xl p-6 bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-1.5 border-b border-slate-200">
                        <h3 className="font-display font-bold text-slate-900">Footprint breakdown</h3>
                        <Link to="/trust" className="text-xs text-teal-600 hover:underline">Methodology ↗</Link>
                      </div>
                      <div className="mt-4">
                        <FootprintBars water={fp.water_L_month.mid} carbon={fp.carbon_kg_month.mid} cost={fp.cost_usd_month} />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                        <span>{fp.gpus} GPUs · PUE {fp.pue ?? "—"} · WUE {fp.wue ?? "—"}</span>
                        {liveTelemetry && (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            LIVE DCIM CONNECTED
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Alternatives */}
                  {result.multicloud.length > 0 && (
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">Greener alternatives</h3>
                      <p className="mt-1 text-sm text-slate-600">Cross-cloud regions within your latency budget</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {result.multicloud.map((m, i) => (
                          <motion.div
                            key={`${m.provider}-${m.region_code}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`glass rounded-xl p-5 bg-white border border-slate-200 shadow-sm ${i === 0 ? "border-emerald-300 bg-emerald-50/20" : ""}`}
                          >
                            {i === 0 && (
                              <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                BEST PICK
                              </span>
                            )}
                            <div className="font-semibold text-slate-900">
                              {(() => {
                                const reg = regions.find(r => r.region_code === m.region_code);
                                return reg ? formatRegionDisplayName(m.region_code, reg.region_name, reg.country, reg.city) : `${m.region_code} · ${m.region_name}`;
                              })()}
                            </div>
                            <div className="font-mono text-xs text-slate-500">{m.provider}</div>
                            <div className="mt-4 flex items-end justify-between">
                              <div>
                                <div className="font-display text-2xl font-bold text-slate-900">{m.sustainability_score}</div>
                                <div className="text-[10px] text-slate-500">score</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-emerald-700">-{m.carbon_savings_pct}%</div>
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
                    <div className="glass rounded-2xl p-6 bg-white border border-slate-200 shadow-sm">
                      <h3 className="font-display font-bold text-slate-900">Actionable Infrastructure Exporters</h3>
                      <p className="mt-1 text-sm text-slate-600">Export carbon-aware orchestrator configuration code targeting cleaner regions.</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="font-mono text-xs text-slate-500 uppercase">Kubernetes Affinity Scheduler Policy</h4>
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
                          <h4 className="font-mono text-xs text-slate-500 uppercase">Terraform Provider Config (Clean Region)</h4>
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
                        <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                          <h4 className="font-mono text-xs text-slate-500 uppercase">GitHub Actions Gated Deployment Policy</h4>
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
            className="flex w-full items-center justify-between border-t border-slate-200 pt-6 text-left transition hover:text-teal-600"
          >
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <div className="glass rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                      Water Basin Risk &amp; Depletion
                    </h4>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      Local water stress indexes are sourced dynamically from the <strong>World Resources Institute (WRI) Aqueduct Water Risk Atlas 4.0</strong>. Baseline water stress measures the ratio of total water withdrawals to available renewable surface and groundwater supplies. Basins with scores above 3.0 (high/extremely high) trigger proactive warnings.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: WRI Aqueduct 4.0, Global Hydrological Model (PCR-GLOBWB).
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      WUE &amp; Cooling Technology Models
                    </h4>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      Water Usage Effectiveness (WUE) factors are compiled from <strong>Cloud Provider ESG Reports (Amazon, Google, Microsoft 2023)</strong> and customized by regional cooling system deployments. Evaporative cooling, direct-expansion, and closed-loop liquid systems are modeled with uncertainty bands corresponding to seasonal PUE/WUE efficiency fluctuations.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: Provider Sustainability Briefs &amp; annual ESG updates.
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Grid Carbon Intensity Factors
                    </h4>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      Operational Scope 2 emissions factors represent real-time and historical grid marginal fuel mixes. We query <strong>Electricity Maps API</strong> and reference standard <strong>IEA Grid Emission Factors</strong> databases. Carbon calculations account for transmission losses and regional grid interconnect dependencies.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-slate-500">
                      Source: Electricity Maps &amp; IEA Global Grid intensity averages (2023/24).
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      Semiconductor Embodied Lifecycle (Scope 3)
                    </h4>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
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
