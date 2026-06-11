import type {
  AnalyzeRequest,
  AnalyzeResult,
  CaseStudy,
  LeaderboardEntry,
  MapPoint,
  Meta,
  Region,
  ValidationSummary,
} from "../types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function post<T>(path: string, body: unknown, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  meta: () => get<Meta>("/meta"),
  regions: (provider?: string) =>
    get<{ count: number; regions: Region[] }>(provider ? `/regions?provider=${provider}` : "/regions"),
  mapPoints: () => get<{ count: number; points: MapPoint[] }>("/regions/map"),
  locations: () => get<{ locations: string[] }>("/locations"),
  analyze: (req: AnalyzeRequest, topN = 10, apiKey?: string) =>
    post<AnalyzeResult>(`/analyze?top_n=${topN}`, req, apiKey),
  leaderboard: (params: URLSearchParams) =>
    get<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard?${params}`),
  validateAll: () => get<ValidationSummary>("/validate/all"),
  caseStudy: () => get<CaseStudy>("/case-study/india-nordic"),
  clusters: () => get<Record<string, unknown>>("/clusters"),
};
