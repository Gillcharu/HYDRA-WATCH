import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "../types";

function scoreColor(score: number): string {
  if (score >= 70) return "#14b8a6"; // mint/cyan
  if (score >= 50) return "#06b6d4"; // blue-cyan
  if (score >= 35) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function getDotColor(point: MapPoint, layer: "score" | "water" | "carbon"): string {
  if (layer === "water") {
    if (point.water_stress <= 1.5) return "#14b8a6"; // low (mint/cyan)
    if (point.water_stress <= 3.5) return "#f59e0b"; // moderate (amber)
    return "#ef4444"; // critical (red)
  }
  if (layer === "carbon") {
    if (point.carbon <= 0.15) return "#14b8a6"; // low (mint/cyan)
    if (point.carbon <= 0.45) return "#f59e0b"; // moderate (amber)
    return "#ef4444"; // high (red)
  }
  return scoreColor(point.score);
}

export function WorldMap({ points }: { points: MapPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<MapPoint | null>(null);
  const [layer, setLayer] = useState<"score" | "water" | "carbon">("score");

  // Rotation angles (in radians)
  const rotationY = useRef(3.5); // spin
  const rotationX = useRef(0.3); // tilt
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, rY: 0, rX: 0 });
  const hoveredIndex = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      canvas.width = rect?.width || 800;
      canvas.height = 480;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Set initial active point
    if (points.length && !active) {
      const initial = points.find((p) => p.score >= 70) || points[0];
      setActive(initial);
    }

    const render = () => {
      if (!isDragging.current) {
        // Slow auto-rotation
        rotationY.current += 0.0015;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.38; // Radius relative to viewport

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Globe Sphere Background (3D shading)
      const radialGrad = ctx.createRadialGradient(
        cx - R / 4,
        cy - R / 4,
        R * 0.1,
        cx,
        cy,
        R
      );
      radialGrad.addColorStop(0, "#0b172a"); // Dark slate inner
      radialGrad.addColorStop(0.7, "#030712"); // Abyss gray
      radialGrad.addColorStop(1, "#020617"); // Pure dark edge
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.fillStyle = radialGrad;
      ctx.fill();

      // Outer thin glowing boundary
      ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const rY = rotationY.current;
      const rX = rotationX.current;

      // Project spherical (lat, lon) coordinates to 3D space with rotation
      const project = (lat: number, lon: number) => {
        const radLat = (lat * Math.PI) / 180;
        const radLon = (lon * Math.PI) / 180;

        // Cartesian mapping (z is forward towards viewer)
        const x = R * Math.cos(radLat) * Math.sin(radLon);
        const y = -R * Math.sin(radLat);
        const z = R * Math.cos(radLat) * Math.cos(radLon);

        // Y-axis rotation (spin)
        const x1 = x * Math.cos(rY) - z * Math.sin(rY);
        const z1 = x * Math.sin(rY) + z * Math.cos(rY);
        const y1 = y;

        // X-axis rotation (tilt)
        const x2 = x1;
        const y2 = y1 * Math.cos(rX) - z1 * Math.sin(rX);
        const z2 = y1 * Math.sin(rX) + z1 * Math.cos(rX);

        return { x: cx + x2, y: cy + y2, z: z2 };
      };

      // 2. Draw Latitudes Grid Lines
      const latSteps = [-60, -30, 0, 30, 60];
      latSteps.forEach((lat) => {
        ctx.beginPath();
        let first = true;
        for (let lon = 0; lon <= 360; lon += 5) {
          const pt = project(lat, lon);
          if (pt.z > -20) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = lat === 0 ? "rgba(8, 145, 178, 0.16)" : "rgba(8, 145, 178, 0.05)";
        ctx.lineWidth = lat === 0 ? 1.5 : 1;
        ctx.stroke();
      });

      // 3. Draw Longitudes Grid Lines
      const lonSteps = [0, 45, 90, 135, 180, 225, 270, 315];
      lonSteps.forEach((lon) => {
        ctx.beginPath();
        let first = true;
        for (let lat = -80; lat <= 80; lat += 5) {
          const pt = project(lat, lon);
          if (pt.z > -20) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = "rgba(8, 145, 178, 0.05)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 4. Project and Draw Region Dots
      const projectedDots = points.map((p, index) => {
        return {
          point: p,
          index,
          ...project(p.lat, p.lon),
        };
      });

      // Draw back-facing dots (z < 0) first, then front-facing dots (z > 0)
      projectedDots.sort((a, b) => a.z - b.z);

      projectedDots.forEach((d) => {
        const color = getDotColor(d.point, layer);
        const isActive = active?.region_code === d.point.region_code;
        const isHovered = hoveredIndex.current === d.index;

        if (d.z < 0) {
          // Transparent indicators for regions on the far side
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(148, 163, 184, 0.15)";
          ctx.fill();
        } else {
          // Front-facing regions
          ctx.beginPath();
          const radius = isActive || isHovered ? 6.5 : 4.5;
          ctx.arc(d.x, d.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();

          // Accent ring for active/hovered indicators
          if (isActive || isHovered) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, radius + 4, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(d.x, d.y, radius + 8, 0, 2 * Math.PI);
            ctx.strokeStyle = `${color}22`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [points, active, layer]);

  // Mouse / Touch handlers for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      rY: rotationY.current,
      rX: rotationX.current,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      rotationY.current = dragStart.current.rY + dx * 0.005;
      rotationX.current = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, dragStart.current.rX + dy * 0.005)
      );
      return;
    }

    // Hover collision detection
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.38;

    const rY = rotationY.current;
    const rX = rotationX.current;

    let closestIndex: number | null = null;
    let minDistance = 12; // Hover detection radius in pixels

    points.forEach((p, index) => {
      const radLat = (p.lat * Math.PI) / 180;
      const radLon = (p.lon * Math.PI) / 180;

      const x = R * Math.cos(radLat) * Math.sin(radLon);
      const y = -R * Math.sin(radLat);
      const z = R * Math.cos(radLat) * Math.cos(radLon);

      const x1 = x * Math.cos(rY) - z * Math.sin(rY);
      const z1 = x * Math.sin(rY) + z * Math.cos(rY);
      const y1 = y;

      const x2 = x1;
      const y2 = y1 * Math.cos(rX) - z1 * Math.sin(rX);
      const z2 = y1 * Math.sin(rX) + z1 * Math.cos(rX);

      // Only check front side coordinates
      if (z2 > 0) {
        const px = cx + x2;
        const py = cy + y2;
        const dist = Math.hypot(mx - px, my - py);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = index;
        }
      }
    });

    if (closestIndex !== null) {
      hoveredIndex.current = closestIndex;
      setActive(points[closestIndex]);
    } else {
      hoveredIndex.current = null;
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    hoveredIndex.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      rY: rotationY.current,
      rX: rotationX.current,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    rotationY.current = dragStart.current.rY + dx * 0.005;
    rotationX.current = Math.max(
      -Math.PI / 2.3,
      Math.min(Math.PI / 2.3, dragStart.current.rX + dy * 0.005)
    );
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden bg-gradient-to-b from-abyss-900 to-abyss-950 min-h-[480px]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        className="block cursor-grab active:cursor-grabbing mx-auto"
      />

      <div className="absolute left-4 top-4 glass rounded-xl px-4 py-3 pointer-events-none">
        <div className="font-display text-sm font-bold text-white">{points.length} regions</div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Drag to spin globe · Hover dots</div>
      </div>

      {/* Interactive Layer Toggles */}
      <div className="absolute right-4 top-4 glass rounded-xl p-1 flex gap-1 z-10 pointer-events-auto">
        {(["score", "water", "carbon"] as const).map((l) => (
          <button
            key={l}
            onClick={(e) => {
              e.stopPropagation();
              setLayer(l);
            }}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition ${
              layer === l
                ? "bg-gradient-to-r from-aqua-500 to-mint-500 text-abyss-950 shadow-sm shadow-aqua-500/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {l === "score" ? "Score" : l === "water" ? "Water" : "Carbon"}
          </button>
        ))}
      </div>

      {active && (
        <div className="absolute bottom-4 left-4 right-4 glass-strong rounded-xl p-5 md:left-auto md:w-80">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display font-bold text-white">{active.region_name}</div>
              <div className="mt-0.5 font-mono text-[10px] text-aqua-400">
                {active.provider} · {active.region_code}
              </div>
            </div>
            <div
              className="rounded-lg px-2 py-1 font-display text-lg font-bold text-abyss-950 shadow-md"
              style={{ backgroundColor: getDotColor(active, layer) }}
            >
              {layer === "water" ? (active.water_stress === 0 ? "Low" : active.water_stress.toFixed(1)) : layer === "carbon" ? active.carbon.toFixed(2) : active.score.toFixed(0)}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`rounded-lg p-2 transition ${layer === "carbon" ? "bg-amber-500/20 border border-amber-500/35" : "bg-white/5"}`}>
              <div className="text-slate-500">Carbon</div>
              <div className="font-mono font-bold text-white mt-0.5">{active.carbon}</div>
            </div>
            <div className={`rounded-lg p-2 transition ${layer === "water" ? "bg-cyan-500/20 border border-cyan-500/35" : "bg-white/5"}`}>
              <div className="text-slate-500">Water</div>
              <div className="font-mono font-bold text-white text-[10px] leading-tight mt-0.5">
                {active.water_stress === 0 ? "Low" : `${active.water_stress.toFixed(2)}/5`}
              </div>
            </div>
            <div className={`rounded-lg p-2 transition ${layer === "score" ? "bg-mint-500/20 border border-mint-500/35" : "bg-white/5"}`}>
              <div className="text-slate-500">Rating</div>
              <div className="font-mono font-bold text-white mt-0.5">{active.score.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-6 border-t border-white/5 bg-abyss-950/80 px-4 py-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-mint-500" /> 70+ excellent
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-aqua-500" /> 50–69 good
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 35–49 review
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" /> &lt;35 high risk
        </span>
      </div>
    </div>
  );
}
