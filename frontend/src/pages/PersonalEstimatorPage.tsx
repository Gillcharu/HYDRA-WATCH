import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FadeIn } from "../components/AnimatedCounter";
import { api } from "../lib/api";
import type { Region } from "../types";

// User location coordinates mapped from GLOBAL_USER_LOCATIONS
const USER_COORDS: Record<string, [number, number]> = {
  "Mumbai, India": [19.08, 72.88],
  "Delhi, India": [28.61, 77.21],
  "Bangalore, India": [12.97, 77.59],
  "Singapore": [1.35, 103.82],
  "Tokyo, Japan": [35.68, 139.69],
  "Seoul, South Korea": [37.57, 126.98],
  "Sydney, Australia": [-33.87, 151.21],
  "Melbourne, Australia": [-37.81, 144.96],
  "Jakarta, Indonesia": [-6.21, 106.85],
  "Hong Kong": [22.32, 114.17],
  "Shanghai, China": [31.23, 121.47],
  "Beijing, China": [39.90, 116.41],
  "Taipei, Taiwan": [25.03, 121.57],
  "Bangkok, Thailand": [13.76, 100.50],
  "Dubai, UAE": [25.20, 55.27],
  "London, UK": [51.51, -0.13],
  "Frankfurt, Germany": [50.11, 8.68],
  "Amsterdam, Netherlands": [52.37, 4.90],
  "Paris, France": [48.86, 2.35],
  "Stockholm, Sweden": [59.33, 18.07],
  "Oslo, Norway": [59.91, 10.75],
  "Helsinki, Finland": [60.17, 24.94],
  "Dublin, Ireland": [53.35, -6.26],
  "Zurich, Switzerland": [47.37, 8.54],
  "Madrid, Spain": [40.42, -3.70],
  "Milan, Italy": [45.46, 9.19],
  "Warsaw, Poland": [52.23, 21.01],
  "New York, USA": [40.71, -74.01],
  "Virginia, USA": [39.04, -77.49],
  "California, USA": [37.34, -121.89],
  "Oregon, USA": [45.84, -119.70],
  "Texas, USA": [31.97, -99.90],
  "Chicago, USA": [41.88, -87.63],
  "São Paulo, Brazil": [-23.55, -46.63],
  "Toronto, Canada": [43.65, -79.38],
  "Montreal, Canada": [45.50, -73.57],
  "Mexico City, Mexico": [19.43, -99.13],
  "Cape Town, South Africa": [-33.92, 18.42],
  "Johannesburg, South Africa": [-26.20, 28.04],
  "Lagos, Nigeria": [6.52, 3.38],
  "Nairobi, Kenya": [-1.29, 36.82],
  "Tel Aviv, Israel": [32.09, 34.78],
  "Riyadh, Saudi Arabia": [24.71, 46.67]
};

// Cloud region coordinates mapping (using REGION_COORDS from geo.py)
const REGION_COORDS: Record<string, [number, number]> = {
  "us-east-1": [39.04, -77.49],
  "us-east-2": [40.14, -83.02],
  "us-west-1": [37.35, -121.95],
  "us-west-2": [45.84, -119.70],
  "ap-south-1": [19.08, 72.88],
  "ap-south-2": [17.38, 78.48],
  "ap-southeast-1": [1.35, 103.82],
  "ap-southeast-2": [-33.86, 151.20],
  "ap-northeast-1": [35.68, 139.76],
  "ap-northeast-2": [37.56, 126.97],
  "ap-northeast-3": [34.69, 135.50],
  "eu-west-1": [53.35, -6.26],
  "eu-west-2": [51.50, -0.12],
  "eu-west-3": [48.85, 2.35],
  "eu-central-1": [50.11, 8.68],
  "eu-central-2": [47.37, 8.54],
  "eu-north-1": [59.33, 18.06],
  "eu-south-1": [45.46, 9.19],
  "sa-east-1": [-23.55, -46.63],
  "ca-central-1": [45.50, -73.57],
  "me-south-1": [26.22, 50.58],
  "af-south-1": [-33.92, 18.42]
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function PersonalEstimatorPage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [aiTool, setAiTool] = useState("ChatGPT");
  const [usage, setUsage] = useState(10); // prompts per day
  const [promptType, setPromptType] = useState("simple");

  useEffect(() => {
    api.locations().then((d) => setLocations(d.locations)).catch(console.error);
    api.regions().then((d) => setRegions(d.regions)).catch(console.error);
  }, []);

  // Map location to closest region and fetch parameters
  const activeParams = useMemo(() => {
    if (!selectedLocation || regions.length === 0) {
      return {
        carbonIntensityMin: 0.30, // kg CO2/kWh or g CO2/Wh
        carbonIntensityMax: 0.55,
        waterStress: 2.5,
        regionName: "Global Average Grid",
        wueMin: 0.4,
        wueMax: 1.2,
      };
    }

    const userLocCoords = USER_COORDS[selectedLocation];
    if (!userLocCoords) {
      return {
        carbonIntensityMin: 0.30,
        carbonIntensityMax: 0.55,
        waterStress: 2.5,
        regionName: "Global Average Grid",
        wueMin: 0.4,
        wueMax: 1.2,
      };
    }

    const [uLat, uLon] = userLocCoords;
    let closestRegion: Region | null = null;
    let minDistance = Infinity;

    // Filter regions that have coordinates mapped
    regions.forEach((r) => {
      const coords = REGION_COORDS[r.region_code];
      if (coords) {
        const [rLat, rLon] = coords;
        const dist = haversineDistance(uLat, uLon, rLat, rLon);
        if (dist < minDistance) {
          minDistance = dist;
          closestRegion = r;
        }
      }
    });

    if (!closestRegion) {
      return {
        carbonIntensityMin: 0.30,
        carbonIntensityMax: 0.55,
        waterStress: 2.5,
        regionName: "Global Average Grid",
        wueMin: 0.4,
        wueMax: 1.2,
      };
    }

    const reg = closestRegion as Region;
    const carbon = reg.carbon_kg_per_kwh || 0.40;
    const stress = reg.water_stress_score || 2.0;

    // Approximate PUE & WUE values based on provider/water stress
    return {
      carbonIntensityMin: carbon * 0.85,
      carbonIntensityMax: carbon * 1.15,
      waterStress: stress,
      regionName: `${reg.provider} ${reg.region_name} (${reg.region_code})`,
      wueMin: stress > 3.5 ? 0.8 : 0.2,
      wueMax: stress > 3.5 ? 1.6 : 0.9,
    };
  }, [selectedLocation, regions]);

  // Compute Footprint Estimates
  const estimates = useMemo(() => {
    // Base parameters in Watt-hours (Wh)
    const baseEnergy: Record<string, { min: number; max: number }> = {
      simple: { min: 0.3, max: 1.2 },
      long: { min: 1.2, max: 3.8 },
      coding: { min: 2.2, max: 8.0 },
      image: { min: 7.0, max: 28.0 },
    };

    const toolMultipliers: Record<string, number> = {
      ChatGPT: 1.0,
      Gemini: 1.05,
      Claude: 1.1,
      Copilot: 0.9,
    };

    const multiplier = toolMultipliers[aiTool] || 1.0;
    const typeBase = baseEnergy[promptType] || baseEnergy.simple;

    // Apply multiplier to base values
    const energyMin = typeBase.min * multiplier;
    const energyMax = typeBase.max * multiplier;

    // Datacenter PUE (Power Usage Effectiveness) ranges from 1.1 to 1.3
    const pueMin = 1.12;
    const pueMax = 1.28;
    const totalEnergyMin = energyMin * pueMin;
    const totalEnergyMax = energyMax * pueMax;

    // Carbon estimation in grams (g CO2e)
    // carbon_kg_per_kwh * 1000 = g/kWh. So totalEnergy (Wh) / 1000 * carbon_g_per_kwh = totalEnergy * carbonIntensity
    const carbonMin = totalEnergyMin * activeParams.carbonIntensityMin;
    const carbonMax = totalEnergyMax * activeParams.carbonIntensityMax;

    // Water estimation in Liters (L)
    // Direct water is evaporative site cooling (often 0.05 to 0.4 L depending on workload size)
    const baseDirectWater: Record<string, { min: number; max: number }> = {
      simple: { min: 0.02, max: 0.12 },
      long: { min: 0.06, max: 0.22 },
      coding: { min: 0.12, max: 0.45 },
      image: { min: 0.35, max: 1.40 },
    };
    const directWater = baseDirectWater[promptType] || baseDirectWater.simple;

    // Scale direct water based on local basin stress
    const stressScale = activeParams.waterStress / 2.5; // normalized around average 2.5
    const finalDirectMin = directWater.min * multiplier * Math.max(0.7, stressScale);
    const finalDirectMax = directWater.max * multiplier * Math.max(0.7, stressScale);

    // Indirect water is consumed at power plants (Wh / 1000 * WUE)
    const indirectMin = (totalEnergyMin / 1000) * activeParams.wueMin;
    const indirectMax = (totalEnergyMax / 1000) * activeParams.wueMax;

    const waterMin = finalDirectMin + indirectMin;
    const waterMax = finalDirectMax + indirectMax;

    // Monthly totals (assume daily usage)
    const monthlyMultiplier = usage * 30;
    const monthlyEnergyMin = totalEnergyMin * monthlyMultiplier;
    const monthlyEnergyMax = totalEnergyMax * monthlyMultiplier;
    const monthlyCarbonMin = carbonMin * monthlyMultiplier;
    const monthlyCarbonMax = carbonMax * monthlyMultiplier;
    const monthlyWaterMin = waterMin * monthlyMultiplier;
    const monthlyWaterMax = waterMax * monthlyMultiplier;

    // Confidence Level assessment
    let confidence = "Medium";
    if (selectedLocation) {
      confidence = activeParams.waterStress > 0 ? "Medium-High" : "Medium";
    } else {
      confidence = "Low-Medium";
    }

    return {
      energyMin,
      energyMax,
      totalEnergyMin,
      totalEnergyMax,
      carbonMin,
      carbonMax,
      waterMin,
      waterMax,
      monthlyEnergyMin,
      monthlyEnergyMax,
      monthlyCarbonMin,
      monthlyCarbonMax,
      monthlyWaterMin,
      monthlyWaterMax,
      confidence,
    };
  }, [aiTool, promptType, usage, activeParams]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <FadeIn>
        <div className="inline-flex items-center gap-2 rounded-full border border-aqua-500/30 bg-aqua-500/10 px-4 py-1.5">
          <span className="font-mono text-xs font-medium text-aqua-300">
            For Curious Individuals
          </span>
        </div>
        <h1 className="headline mt-6">Personal AI Use Estimator</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-400">
          How much water, electricity, and carbon does a single LLM or image prompt consume? Customize your typical tool, location, and queries to explore the environmental cost of individual AI interactions.
        </p>
      </FadeIn>

      <div className="mt-12 grid gap-8 lg:grid-cols-12">
        {/* Control Form */}
        <div className="lg:col-span-5">
          <FadeIn delay={0.1}>
            <div className="glass rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-xl font-bold text-white mb-6">Estimate Settings</h2>

              {/* AI Tool */}
              <div className="mb-6">
                <label className="label-dark">AI Assistant Tool</label>
                <div className="grid grid-cols-2 gap-2">
                  {["ChatGPT", "Gemini", "Claude", "Copilot"].map((tool) => (
                    <button
                      key={tool}
                      onClick={() => setAiTool(tool)}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold border transition ${
                        aiTool === tool
                          ? "bg-gradient-to-r from-aqua-500 to-mint-500 border-transparent text-abyss-950 shadow-md shadow-aqua-500/15"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Type */}
              <div className="mb-6">
                <label className="label-dark">Query / Task Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "simple", label: "Simple Search", desc: "Short Q&A search" },
                    { id: "long", label: "Long Synthesis", desc: "Article / essay draft" },
                    { id: "coding", label: "Dense Coding", desc: "Complex logic / debug" },
                    { id: "image", label: "Image Gen", desc: "Text-to-image diffusion" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setPromptType(type.id)}
                      className={`flex flex-col items-start rounded-xl p-3 border text-left transition ${
                        promptType === type.id
                          ? "bg-white/10 border-aqua-400/50 text-white shadow-inner"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-sm font-bold">{type.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <label className="label-dark" htmlFor="user-location-estimator">
                  Your Location (Optional)
                </label>
                <select
                  id="user-location-estimator"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="input-dark appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23cbd5e1%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.65em_auto] bg-[right_1rem_center] bg-no-repeat"
                >
                  <option value="">Choose a location to compute local grid factors...</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-2">
                  If selected, we determine the closest cloud region automatically to fetch real-world water stress scores and energy grid carbon intensities.
                </p>
              </div>

              {/* Usage Frequency */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-dark !mb-0" htmlFor="prompts-slider">Daily AI Prompts</label>
                  <span className="font-mono text-sm font-bold text-mint-400">
                    {usage} prompts / day
                  </span>
                </div>
                <input
                  id="prompts-slider"
                  type="range"
                  min="1"
                  max="150"
                  value={usage}
                  onChange={(e) => setUsage(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-aqua-400 focus:outline-none"
                />
                <div className="flex justify-between font-mono text-[9px] text-slate-500 mt-1">
                  <span>1 prompt</span>
                  <span>50 prompts</span>
                  <span>100 prompts</span>
                  <span>150 prompts</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7">
          <FadeIn delay={0.2}>
            <div className="glass rounded-2xl p-6 md:p-8 flex flex-col justify-between h-full">
              <div>
                <h2 className="font-display text-xl font-bold text-white mb-6">Estimated Impact</h2>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Water */}
                  <div className="rounded-xl border border-white/5 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-cyan-400">Water per query</div>
                    <div className="font-display text-2xl font-bold text-white mt-2">
                      ~{estimates.waterMin < 0.1 ? `${(estimates.waterMin * 1000).toFixed(0)}` : estimates.waterMin.toFixed(2)} to{" "}
                      {estimates.waterMax < 0.1 ? `${(estimates.waterMax * 1000).toFixed(0)} mL` : `${estimates.waterMax.toFixed(2)} L`}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Direct cooling + grid footprint</div>
                  </div>

                  {/* Carbon */}
                  <div className="rounded-xl border border-white/5 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-amber-400">Carbon per query</div>
                    <div className="font-display text-2xl font-bold text-white mt-2">
                      ~{estimates.carbonMin.toFixed(2)} to {estimates.carbonMax.toFixed(2)} g CO₂e
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Equivalent to standard searches</div>
                  </div>

                  {/* Energy */}
                  <div className="rounded-xl border border-white/5 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-mint-400">Energy per query</div>
                    <div className="font-display text-2xl font-bold text-white mt-2">
                      ~{estimates.totalEnergyMin.toFixed(2)} to {estimates.totalEnergyMax.toFixed(2)} Wh
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">GPU consumption + PUE factor</div>
                  </div>
                </div>

                {/* Monthly Total */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-sm font-bold text-white">Monthly estimate (based on {usage} queries/day)</div>
                  <div className="mt-3 grid gap-6 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center font-mono text-cyan-400 font-bold">W</div>
                      <div>
                        <div className="text-xs text-slate-500">Monthly Water Usage</div>
                        <div className="text-lg font-bold text-white">
                          ~{estimates.monthlyWaterMin.toFixed(1)} to {estimates.monthlyWaterMax.toFixed(1)} Liters
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-mono text-amber-400 font-bold">C</div>
                      <div>
                        <div className="text-xs text-slate-500">Monthly Carbon Emissions</div>
                        <div className="text-lg font-bold text-white">
                          ~{estimates.monthlyCarbonMin < 1000 ? `${estimates.monthlyCarbonMin.toFixed(0)} to ${estimates.monthlyCarbonMax.toFixed(0)} g` : `${(estimates.monthlyCarbonMin / 1000).toFixed(2)} to ${(estimates.monthlyCarbonMax / 1000).toFixed(2)} kg`} CO₂e
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info parameters */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-500">Closest modeled center:</span>{" "}
                    <span className="font-medium text-white">{activeParams.regionName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Local Basin Water Stress Score:</span>{" "}
                    <span className="font-medium text-white">{activeParams.waterStress.toFixed(2)} / 5.0</span>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="mt-6 border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Estimate Confidence</span>
                    <span className={`text-xs font-bold ${
                      estimates.confidence.includes("High") ? "text-mint-400" : "text-amber-400"
                    }`}>
                      {estimates.confidence}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        estimates.confidence.includes("High") ? "bg-gradient-to-r from-aqua-400 to-mint-400" : "bg-gradient-to-r from-amber-500 to-aqua-400"
                      }`}
                      style={{
                        width: estimates.confidence.includes("High") ? "85%" : estimates.confidence.includes("Medium") ? "55%" : "30%"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Disclaimer and Reason */}
              <div className="mt-8">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-slate-400">
                  <strong className="text-amber-300">Disclaimer:</strong> The actual data center location is not user-controlled. AI vendors dynamically route individual queries across a global grid of clusters to balance traffic loads and server availability.
                </div>

                <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                  <strong>How we estimate:</strong> Query calculations scale with model parameter size, response length, hardware PUE (typically 1.15), water use efficiency (WUE) of region data centers, and local power grid sources. Since exact operational details of commercial models are proprietary, values are represented as a range.
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
