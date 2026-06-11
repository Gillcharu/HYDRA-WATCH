import { useMemo, useState } from "react";
import type { MapPoint } from "../types";

function scoreColor(score: number): string {
  if (score >= 70) return "#14b8a6";
  if (score >= 50) return "#06b6d4";
  if (score >= 35) return "#f59e0b";
  return "#ef4444";
}

function project(lat: number, lon: number) {
  return { x: ((lon + 180) / 360) * 100, y: ((82 - lat) / 150) * 100 };
}

export function WorldMap({ points }: { points: MapPoint[] }) {
  const [active, setActive] = useState<MapPoint | null>(null);
  const plotted = useMemo(
    () =>
      points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map((p) => ({ ...p, ...project(p.lat, p.lon), color: scoreColor(p.score) })),
    [points],
  );

  if (!plotted.length) {
    return (
      <div className="flex h-[460px] items-center justify-center bg-abyss-900 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aqua-500 border-t-transparent" />
          Loading global region map…
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-abyss-900 to-abyss-950">
      <div className="relative h-[480px] w-full">
        <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="1000" height="500" fill="url(#grid)" />
        </svg>

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden>
          <g fill="#1e3a5f" stroke="#0891b2" strokeWidth="0.8" opacity="0.6">
            <path d="M135 132 C92 145 72 184 82 229 C94 283 143 309 189 288 C224 272 237 231 223 191 C209 151 176 122 135 132 Z" />
            <path d="M231 292 C203 315 196 358 217 395 C239 432 276 447 304 425 C331 404 327 359 307 326 C287 292 257 271 231 292 Z" />
            <path d="M448 126 C404 121 371 141 366 172 C360 204 396 224 441 217 C482 211 508 185 500 155 C493 134 475 129 448 126 Z" />
            <path d="M500 221 C463 248 452 309 486 344 C518 377 572 357 585 308 C597 260 550 187 500 221 Z" />
            <path d="M583 112 C536 128 512 171 531 215 C549 259 610 267 660 247 C724 222 762 178 733 139 C704 101 642 92 583 112 Z" />
            <path d="M708 244 C684 265 688 301 716 318 C748 337 801 321 818 288 C834 256 789 226 751 228 C733 229 718 235 708 244 Z" />
            <path d="M777 337 C750 353 739 388 761 413 C784 441 835 439 862 414 C891 387 871 348 836 335 C814 326 794 327 777 337 Z" />
          </g>
        </svg>

        {plotted.map((p) => (
          <button
            key={`${p.provider}-${p.region_code}`}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 shadow-lg transition-all duration-200 hover:z-20 hover:scale-[2] focus:z-20 focus:scale-[2] focus:outline-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: active?.region_code === p.region_code ? 14 : 10,
              height: active?.region_code === p.region_code ? 14 : 10,
              backgroundColor: p.color,
              boxShadow: active?.region_code === p.region_code ? `0 0 20px ${p.color}` : undefined,
            }}
            onMouseEnter={() => setActive(p)}
            onFocus={() => setActive(p)}
            onClick={() => setActive(p)}
            aria-label={`${p.provider} ${p.region_name} score ${p.score}`}
          />
        ))}

        <div className="absolute left-4 top-4 glass rounded-xl px-4 py-3">
          <div className="font-display text-sm font-bold text-white">{plotted.length} regions</div>
          <div className="text-xs text-slate-500">7 cloud providers · live scores</div>
        </div>

        {active && (
          <div className="absolute bottom-4 left-4 right-4 glass-strong rounded-xl p-5 md:left-auto md:w-80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-white">{active.region_name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-aqua-400">{active.provider} · {active.region_code}</div>
              </div>
              <div
                className="rounded-lg px-2 py-1 font-display text-lg font-bold text-abyss-950"
                style={{ backgroundColor: active.color }}
              >
                {active.score}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-slate-500">Carbon</div>
                <div className="font-mono font-bold text-white">{active.carbon}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-slate-500">Water</div>
                <div className="font-mono font-bold text-white">{active.water_stress}/5</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="text-slate-500">Country</div>
                <div className="truncate font-medium text-white">{active.country}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-6 border-t border-white/5 bg-abyss-950/80 px-4 py-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mint-500" /> 70+ excellent</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-aqua-500" /> 50–69 good</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 35–49 review</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> &lt;35 high risk</span>
      </div>
    </div>
  );
}
