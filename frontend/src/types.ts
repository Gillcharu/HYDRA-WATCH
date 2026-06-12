export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  tag: string;
  provider: string;
  region: string;
  model: string;
  gpu: string;
  qps: number;
  tokens: number;
  location: string;
  latency: number;
}

export interface Meta {
  providers: { id: string; label: string }[];
  gpus: string[];
  models: string[];
  scenarios: Scenario[];
}

export interface Region {
  provider: string;
  region_code: string;
  region_name: string;
  country: string;
  state?: string;
  city?: string;
  carbon_confidence?: string;
  carbon_kg_per_kwh: number;
  water_stress_score: number;
  water_stress_label?: string;
}

export interface MapPoint {
  region_code: string;
  region_name: string;
  provider: string;
  country: string;
  lat: number;
  lon: number;
  score: number;
  carbon: number;
  water_stress: number;
}

export interface MetricRange {
  low: number;
  mid: number;
  high: number;
  unit: string;
}

export interface AnalyzeRequest {
  provider: string;
  region_code: string;
  qps: number;
  avg_tokens: number;
  gpu_type: string;
  model_name: string;
  user_location: string;
  max_latency_ms: number;
  workload_mode?: string;
  quantization?: string;
  framework?: string;
}

export interface AnalyzeResult {
  current: {
    provider: string;
    region_code: string;
    region_name: string;
    sustainability_score: number;
    score_label: string;
    score_components?: Record<string, number>;
    latency_ms: number;
    water_stress_score?: number;
    water_stress_label?: string;
    drought_risk?: number;
    footprint: {
      water_L_month: MetricRange;
      carbon_kg_month: MetricRange;
      cost_usd_month: number;
      gpus: number;
      pue?: number;
      wue?: number;
      energy_tier: string;
      energy_basis: string;
      assumptions: string[];
      embodied_carbon_kg_month?: MetricRange;
      total_carbon_kg_month?: MetricRange;
      embodied_water_L_month?: MetricRange;
      total_water_L_month?: MetricRange;
      offset_cost_usd_month?: number;
      tree_absorption_months?: number;
      quantization?: string;
      framework?: string;
    };
  };
  multicloud: MulticloudOption[];
  verification: {
    footprint_tier: string;
    fields: { name: string; tier: string; source: string; value?: string }[];
  };
  validation: { title: string; pass: boolean; metric: string; tier: string }[];
}

export interface MulticloudOption {
  provider: string;
  region_name: string;
  region_code: string;
  sustainability_score: number;
  carbon_savings_pct: number;
  water_savings_pct: number;
  latency_ms: number;
  migration_cost_usd?: number;
}

export interface LeaderboardEntry {
  rank: number;
  provider: string;
  region_name: string;
  region_code: string;
  country: string;
  sustainability_score: number;
  carbon_month_kg: number;
  water_month_L: number;
  latency_ms: number;
}

export interface ValidationSummary {
  summary: string;
  total: number;
  passed: number;
  pass_rate_pct: number;
  results: {
    provider: string;
    region_code: string;
    region_name: string;
    country: string;
    carbon: number;
    band: string;
    band_source: string;
    pass: boolean;
  }[];
}

export interface CaseStudy {
  title: string;
  conclusion: string;
  pass: boolean;
  references: string[];
  mumbai: Record<string, unknown>;
  stockholm: Record<string, unknown>;
  findings: Record<string, unknown>;
}
