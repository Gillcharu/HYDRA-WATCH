import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
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

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex cursor-help items-center justify-center rounded-full bg-white/10 h-3.5 w-3.5 text-[9px] font-bold text-slate-400 hover:bg-white/20 hover:text-white">
      ?
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-white/10 bg-abyss-950 p-2 text-[10px] font-normal leading-normal text-slate-300 opacity-0 shadow-xl backdrop-blur-xl transition duration-200 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function PersonalEstimatorPage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode and form states (synced from URL search parameters if available)
  const [compareMode, setCompareMode] = useState(() => searchParams.get("compare") === "true");

  // Config A States
  const [aiTool, setAiTool] = useState(() => searchParams.get("tool") || "ChatGPT");
  const [usage, setUsage] = useState(() => Number(searchParams.get("usage")) || 10);
  const [promptType, setPromptType] = useState(() => searchParams.get("type") || "simple");
  const [selectedLocation, setSelectedLocation] = useState(() => searchParams.get("loc") || "");

  // Config B States (Comparison mode)
  const [aiToolB, setAiToolB] = useState(() => searchParams.get("toolB") || "Gemini");
  const [usageB, setUsageB] = useState(() => Number(searchParams.get("usageB")) || 10);
  const [promptTypeB, setPromptTypeB] = useState(() => searchParams.get("typeB") || "simple");
  const [selectedLocationB, setSelectedLocationB] = useState(() => searchParams.get("locB") || "");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.locations().then((d) => setLocations(d.locations)).catch(console.error);
    api.regions().then((d) => setRegions(d.regions)).catch(console.error);
  }, []);

  // Sync state changes to search parameters
  useEffect(() => {
    const params: Record<string, string> = {
      compare: compareMode.toString(),
      tool: aiTool,
      usage: usage.toString(),
      type: promptType,
      loc: selectedLocation,
    };
    if (compareMode) {
      params.toolB = aiToolB;
      params.usageB = usageB.toString();
      params.typeB = promptTypeB;
      params.locB = selectedLocationB;
    }
    setSearchParams(params, { replace: true });
  }, [
    compareMode,
    aiTool,
    usage,
    promptType,
    selectedLocation,
    aiToolB,
    usageB,
    promptTypeB,
    selectedLocationB,
    setSearchParams,
  ]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to resolve region parameters based on user location
  const getActiveParams = (location: string) => {
    if (!location || regions.length === 0) {
      return {
        carbonIntensityMin: 0.30,
        carbonIntensityMax: 0.55,
        waterStress: 2.5,
        regionName: "Global Average Grid",
        wueMin: 0.4,
        wueMax: 1.2,
      };
    }

    const userLocCoords = USER_COORDS[location];
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

    return {
      carbonIntensityMin: carbon * 0.85,
      carbonIntensityMax: carbon * 1.15,
      waterStress: stress,
      regionName: `${reg.provider} ${reg.region_name} (${reg.region_code})`,
      wueMin: stress > 3.5 ? 0.8 : 0.2,
      wueMax: stress > 3.5 ? 1.6 : 0.9,
    };
  };

  const activeParamsA = useMemo(() => getActiveParams(selectedLocation), [selectedLocation, regions]);
  const activeParamsB = useMemo(() => getActiveParams(selectedLocationB), [selectedLocationB, regions]);

  // Main calculation engine
  const calculateFootprint = (
    tool: string,
    type: string,
    promptsPerDay: number,
    locParams: ReturnType<typeof getActiveParams>,
    locationString: string
  ) => {
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

    const multiplier = toolMultipliers[tool] || 1.0;
    const typeBase = baseEnergy[type] || baseEnergy.simple;

    const energyMin = typeBase.min * multiplier;
    const energyMax = typeBase.max * multiplier;

    const pueMin = 1.12;
    const pueMax = 1.28;
    const totalEnergyMin = energyMin * pueMin;
    const totalEnergyMax = energyMax * pueMax;

    const carbonMin = totalEnergyMin * locParams.carbonIntensityMin;
    const carbonMax = totalEnergyMax * locParams.carbonIntensityMax;

    const baseDirectWater: Record<string, { min: number; max: number }> = {
      simple: { min: 0.02, max: 0.12 },
      long: { min: 0.06, max: 0.22 },
      coding: { min: 0.12, max: 0.45 },
      image: { min: 0.35, max: 1.40 },
    };
    const directWater = baseDirectWater[type] || baseDirectWater.simple;

    const stressScale = locParams.waterStress / 2.5;
    const finalDirectMin = directWater.min * multiplier * Math.max(0.7, stressScale);
    const finalDirectMax = directWater.max * multiplier * Math.max(0.7, stressScale);

    const indirectMin = (totalEnergyMin / 1000) * locParams.wueMin;
    const indirectMax = (totalEnergyMax / 1000) * locParams.wueMax;

    const waterMin = finalDirectMin + indirectMin;
    const waterMax = finalDirectMax + indirectMax;

    const monthlyMultiplier = promptsPerDay * 30;

    let confidence = "Medium";
    if (locationString) {
      confidence = locParams.waterStress > 0 ? "Medium-High" : "Medium";
    } else {
      confidence = "Low-Medium";
    }

    return {
      energyMin: totalEnergyMin,
      energyMax: totalEnergyMax,
      carbonMin,
      carbonMax,
      waterMin,
      waterMax,
      monthlyEnergyMin: totalEnergyMin * monthlyMultiplier,
      monthlyEnergyMax: totalEnergyMax * monthlyMultiplier,
      monthlyCarbonMin: carbonMin * monthlyMultiplier,
      monthlyCarbonMax: carbonMax * monthlyMultiplier,
      monthlyWaterMin: waterMin * monthlyMultiplier,
      monthlyWaterMax: waterMax * monthlyMultiplier,
      confidence,
    };
  };

  const estimatesA = useMemo(() => {
    return calculateFootprint(aiTool, promptType, usage, activeParamsA, selectedLocation);
  }, [aiTool, promptType, usage, activeParamsA, selectedLocation]);

  const estimatesB = useMemo(() => {
    return calculateFootprint(aiToolB, promptTypeB, usageB, activeParamsB, selectedLocationB);
  }, [aiToolB, promptTypeB, usageB, activeParamsB, selectedLocationB]);

  // Tangible environmental equivalency helper
  const getEquivalencies = (energy: number, carbon: number, water: number) => {
    // Energy: running a 9W LED bulb (Wh / 9Wh = hours). Convert to minutes if < 1 hour.
    const bulbHrs = energy / 9;
    const bulbDisplay = bulbHrs >= 1 ? `${bulbHrs.toFixed(1)} hrs` : `${(bulbHrs * 60).toFixed(0)} mins`;

    // Carbon: standard gasoline car has ~120g CO2 per km. Carbon (g) / 120 = km. Multiply by 1000 for meters.
    const carMeters = (carbon / 120) * 1000;
    const carDisplay = carMeters >= 1000 ? `${(carMeters / 1000).toFixed(2)} km` : `${carMeters.toFixed(0)} meters`;

    // Water: average faucet flows at 6 liters per minute = 0.1 liters per second. Water (L) / 0.1 = seconds.
    const tapSecs = water / 0.1;
    const tapDisplay = tapSecs >= 60 ? `${(tapSecs / 60).toFixed(1)} mins` : `${tapSecs.toFixed(1)} secs`;

    return { bulbDisplay, carDisplay, tapDisplay };
  };

  const equivsA = useMemo(() => {
    const avgEnergy = (estimatesA.energyMin + estimatesA.energyMax) / 2;
    const avgCarbon = (estimatesA.carbonMin + estimatesA.carbonMax) / 2;
    const avgWater = (estimatesA.waterMin + estimatesA.waterMax) / 2;
    return getEquivalencies(avgEnergy, avgCarbon, avgWater);
  }, [estimatesA]);

  const equivsB = useMemo(() => {
    const avgEnergy = (estimatesB.energyMin + estimatesB.energyMax) / 2;
    const avgCarbon = (estimatesB.carbonMin + estimatesB.carbonMax) / 2;
    const avgWater = (estimatesB.waterMin + estimatesB.waterMax) / 2;
    return getEquivalencies(avgEnergy, avgCarbon, avgWater);
  }, [estimatesB]);

  // Compute comparison delta display
  const comparisonResults = useMemo(() => {
    if (!compareMode) return null;

    const avgWaterA = (estimatesA.waterMin + estimatesA.waterMax) / 2;
    const avgWaterB = (estimatesB.waterMin + estimatesB.waterMax) / 2;
    const avgCarbonA = (estimatesA.carbonMin + estimatesA.carbonMax) / 2;
    const avgCarbonB = (estimatesB.carbonMin + estimatesB.carbonMax) / 2;

    const waterPct = ((avgWaterB - avgWaterA) / avgWaterA) * 100;
    const carbonPct = ((avgCarbonB - avgCarbonA) / avgCarbonA) * 100;

    return {
      waterDelta: waterPct,
      carbonDelta: carbonPct,
    };
  }, [compareMode, estimatesA, estimatesB]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-aqua-500/30 bg-aqua-500/10 px-4 py-1.5">
              <span className="font-mono text-xs font-medium text-aqua-300">
                For Curious Individuals
              </span>
            </div>
            <h1 className="headline mt-4">Personal AI Use Estimator</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              How much water, electricity, and carbon does a single LLM or image prompt consume? Customize your typical tool, location, and queries to explore the environmental cost of individual AI interactions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Compare Mode Toggle */}
            <button
              onClick={() => setCompareMode((c) => !c)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition ${
                compareMode
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 border-transparent text-white shadow-lg shadow-purple-500/15"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              {compareMode ? "✓ Side-by-Side Active" : "⚡ Compare Mode"}
            </button>

            {/* Share link button */}
            <button
              onClick={handleShare}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition duration-200 ${
                copied
                  ? "bg-mint-500 border-transparent text-abyss-950"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              {copied ? "✓ Link Copied!" : "🔗 Share Estimate"}
            </button>
          </div>
        </div>
      </FadeIn>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* Forms Card Container */}
        <div className={compareMode ? "lg:col-span-12 grid gap-6 md:grid-cols-2" : "lg:col-span-5"}>
          {/* CONFIGURATION A */}
          <FadeIn delay={0.1}>
            <div className={`glass rounded-2xl p-6 md:p-8 h-full transition-all ${compareMode ? "border-aqua-500/25 ring-1 ring-aqua-500/10" : ""}`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold text-white">
                  {compareMode ? "Configuration A" : "Estimate Settings"}
                </h2>
                {compareMode && (
                  <span className="h-2.5 w-2.5 rounded-full bg-aqua-400 animate-pulse" />
                )}
              </div>

              {/* AI Tool */}
              <div className="mb-6">
                <label className="label-dark flex items-center">
                  AI Assistant Tool
                  <Tooltip text="Select the specific conversational AI model or assistant to estimate its query parameters." />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["ChatGPT", "Gemini", "Claude", "Copilot"].map((tool) => (
                    <button
                      key={tool}
                      onClick={() => setAiTool(tool)}
                      className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition ${
                        aiTool === tool
                          ? "bg-gradient-to-r from-aqua-500 to-mint-500 border-transparent text-abyss-950 shadow-md shadow-aqua-500/10"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Type */}
              <div className="mb-6">
                <label className="label-dark flex items-center">
                  Query / Task Type
                  <Tooltip text="Compute varies by workload: simple searches use fewer parameters, while coding and image diffusion models require significantly higher floating-point operations (FLOPs)." />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "simple", label: "Simple Search", desc: "Short lookup / chat" },
                    { id: "long", label: "Long Synthesis", desc: "Essay / summarization" },
                    { id: "coding", label: "Dense Coding", desc: "Complex programming" },
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
                      <span className="text-xs font-bold">{type.label}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <label className="label-dark flex items-center" htmlFor="location-select-a">
                  Your Location (Optional)
                  <Tooltip text="Used to compute geographical network routing distance and map your request to the nearest cloud data center's grid carbon factor and water watershed stress." />
                </label>
                <select
                  id="location-select-a"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="input-dark pr-10"
                >
                  <option value="">Global Average Grid...</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Usage Frequency */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-dark !mb-0 flex items-center" htmlFor="prompts-slider-a">
                    Daily AI Prompts
                    <Tooltip text="Adjust the slider to scale your daily prompt queries to a cumulative monthly footprint." />
                  </label>
                  <span className="font-mono text-xs font-bold text-mint-400">
                    {usage} prompts / day
                  </span>
                </div>
                <input
                  id="prompts-slider-a"
                  type="range"
                  min="1"
                  max="150"
                  value={usage}
                  onChange={(e) => setUsage(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-aqua-400 focus:outline-none"
                />
              </div>
            </div>
          </FadeIn>

          {/* CONFIGURATION B (Visible only in compareMode) */}
          <AnimatePresence>
            {compareMode && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <div className="glass border-purple-500/25 ring-1 ring-purple-500/10 rounded-2xl p-6 md:p-8 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-lg font-bold text-white">Configuration B</h2>
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400 animate-pulse" />
                  </div>

                  {/* AI Tool */}
                  <div className="mb-6">
                    <label className="label-dark flex items-center">
                      AI Assistant Tool
                      <Tooltip text="Select the specific conversational AI model or assistant to estimate its query parameters." />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["ChatGPT", "Gemini", "Claude", "Copilot"].map((tool) => (
                        <button
                          key={tool}
                          onClick={() => setAiToolB(tool)}
                          className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition ${
                            aiToolB === tool
                              ? "bg-gradient-to-r from-purple-500 to-indigo-500 border-transparent text-white shadow-md shadow-purple-500/10"
                              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Type */}
                  <div className="mb-6">
                    <label className="label-dark flex items-center">
                      Query / Task Type
                      <Tooltip text="Compute varies by workload: simple searches use fewer parameters, while coding and image diffusion models require significantly higher floating-point operations (FLOPs)." />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "simple", label: "Simple Search", desc: "Short lookup / chat" },
                        { id: "long", label: "Long Synthesis", desc: "Essay / summarization" },
                        { id: "coding", label: "Dense Coding", desc: "Complex programming" },
                        { id: "image", label: "Image Gen", desc: "Text-to-image diffusion" },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setPromptTypeB(type.id)}
                          className={`flex flex-col items-start rounded-xl p-3 border text-left transition ${
                            promptTypeB === type.id
                              ? "bg-white/10 border-purple-400/50 text-white shadow-inner"
                              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          <span className="text-xs font-bold">{type.label}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5">{type.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="mb-6">
                    <label className="label-dark flex items-center" htmlFor="location-select-b">
                      Your Location (Optional)
                      <Tooltip text="Used to compute geographical network routing distance and map your request to the nearest cloud data center's grid carbon factor and water watershed stress." />
                    </label>
                    <select
                      id="location-select-b"
                      value={selectedLocationB}
                      onChange={(e) => setSelectedLocationB(e.target.value)}
                      className="input-dark pr-10"
                    >
                      <option value="">Global Average Grid...</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Usage Frequency */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-dark !mb-0 flex items-center" htmlFor="prompts-slider-b">
                        Daily AI Prompts
                        <Tooltip text="Adjust the slider to scale your daily prompt queries to a cumulative monthly footprint." />
                      </label>
                      <span className="font-mono text-xs font-bold text-purple-400">
                        {usageB} prompts / day
                      </span>
                    </div>
                    <input
                      id="prompts-slider-b"
                      type="range"
                      min="1"
                      max="150"
                      value={usageB}
                      onChange={(e) => setUsageB(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results Panel */}
        <div className={compareMode ? "lg:col-span-12" : "lg:col-span-7"}>
          <FadeIn delay={0.2}>
            <div className="glass rounded-2xl p-6 md:p-8 flex flex-col justify-between h-full">
              <div>
                <h2 className="font-display text-xl font-bold text-white mb-6">Estimated Impact</h2>

                {/* Estimation Values Grid */}
                <div className={`grid gap-6 ${compareMode ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  {/* CONFIG A (AND REGULAR MODE) DISPLAY */}
                  <div className={`space-y-4 ${compareMode ? "border-r border-white/5 pr-6" : ""}`}>
                    {compareMode && (
                      <div className="text-xs font-bold text-aqua-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-aqua-400" /> Config A ({aiTool})
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                      {/* Water */}
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-cyan-400 flex items-center">
                          Water per query
                          <Tooltip text="Direct site water used for evaporative cooling plus indirect water consumed at regional power plants during electricity generation." />
                        </div>
                        <div className="font-display text-lg font-bold text-white mt-1.5">
                          ~{estimatesA.waterMin < 0.1 ? `${(estimatesA.waterMin * 1000).toFixed(0)}` : estimatesA.waterMin.toFixed(2)} to{" "}
                          {estimatesA.waterMax < 0.1 ? `${(estimatesA.waterMax * 1000).toFixed(0)} mL` : `${estimatesA.waterMax.toFixed(2)} L`}
                        </div>
                      </div>

                      {/* Carbon */}
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-amber-400 flex items-center">
                          Carbon per query
                          <Tooltip text="Equivalent grid carbon emissions (g CO2e) generated from power plant energy grid sources matching the datacenter's location." />
                        </div>
                        <div className="font-display text-lg font-bold text-white mt-1.5">
                          ~{estimatesA.carbonMin.toFixed(2)} to {estimatesA.carbonMax.toFixed(2)} g CO₂e
                        </div>
                      </div>

                      {/* Energy */}
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-mint-400 flex items-center">
                          Energy per query
                          <Tooltip text="Total electricity (Wh) consumed by the GPU server hardware, including datacenter PUE (overhead cooling/lighting factors)." />
                        </div>
                        <div className="font-display text-lg font-bold text-white mt-1.5">
                          ~{estimatesA.energyMin.toFixed(2)} to {estimatesA.energyMax.toFixed(2)} Wh
                        </div>
                      </div>
                    </div>

                    {/* Equivalencies (Section 2) */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.01] p-4">
                      <div className="text-xs font-bold text-slate-300 border-b border-white/5 pb-2 mb-2 uppercase tracking-wide">
                        Query Equivalencies
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div>
                          <div className="text-slate-500">💡 LED Bulb</div>
                          <div className="font-mono font-bold text-white mt-1">{equivsA.bulbDisplay}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">🚗 Gas Car</div>
                          <div className="font-mono font-bold text-white mt-1">{equivsA.carDisplay}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">🚰 Tap Flow</div>
                          <div className="font-mono font-bold text-white mt-1">{equivsA.tapDisplay}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONFIG B DISPLAY (Visible only in compareMode) */}
                  {compareMode && (
                    <div className="space-y-4 pl-2">
                      <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-400" /> Config B ({aiToolB})
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                        {/* Water */}
                        <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-cyan-400 flex items-center">
                            Water per query
                            <Tooltip text="Direct site water used for evaporative cooling plus indirect water consumed at regional power plants during electricity generation." />
                          </div>
                          <div className="font-display text-lg font-bold text-white mt-1.5">
                            ~{estimatesB.waterMin < 0.1 ? `${(estimatesB.waterMin * 1000).toFixed(0)}` : estimatesB.waterMin.toFixed(2)} to{" "}
                            {estimatesB.waterMax < 0.1 ? `${(estimatesB.waterMax * 1000).toFixed(0)} mL` : `${estimatesB.waterMax.toFixed(2)} L`}
                          </div>
                        </div>

                        {/* Carbon */}
                        <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-amber-400 flex items-center">
                            Carbon per query
                            <Tooltip text="Equivalent grid carbon emissions (g CO2e) generated from power plant energy grid sources matching the datacenter's location." />
                          </div>
                          <div className="font-display text-lg font-bold text-white mt-1.5">
                            ~{estimatesB.carbonMin.toFixed(2)} to {estimatesB.carbonMax.toFixed(2)} g CO₂e
                          </div>
                        </div>

                        {/* Energy */}
                        <div className="rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-mint-400 flex items-center">
                            Energy per query
                            <Tooltip text="Total electricity (Wh) consumed by the GPU server hardware, including datacenter PUE (overhead cooling/lighting factors)." />
                          </div>
                          <div className="font-display text-lg font-bold text-white mt-1.5">
                            ~{estimatesB.energyMin.toFixed(2)} to {estimatesB.energyMax.toFixed(2)} Wh
                          </div>
                        </div>
                      </div>

                      {/* Equivalencies (Section 2) */}
                      <div className="rounded-xl border border-purple-500/15 bg-white/[0.01] p-4">
                        <div className="text-xs font-bold text-slate-300 border-b border-white/5 pb-2 mb-2 uppercase tracking-wide">
                          Query Equivalencies
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <div className="text-slate-500">💡 LED Bulb</div>
                            <div className="font-mono font-bold text-white mt-1">{equivsB.bulbDisplay}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">🚗 Gas Car</div>
                            <div className="font-mono font-bold text-white mt-1">{equivsB.carDisplay}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">🚰 Tap Flow</div>
                            <div className="font-mono font-bold text-white mt-1">{equivsB.tapDisplay}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compare Mode Delta Card */}
                {compareMode && comparisonResults && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="text-sm font-bold text-white mb-3 flex items-center gap-1">
                      <span>🆚 Comparison Analysis</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs font-semibold">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center font-mono text-cyan-400 font-bold">W</div>
                        <div>
                          <span className="text-slate-500">Water Footprint Difference:</span>{" "}
                          <span className={comparisonResults.waterDelta < 0 ? "text-mint-400" : "text-amber-500"}>
                            {comparisonResults.waterDelta < 0 ? "Config B saves" : "Config B adds"}{" "}
                            {Math.abs(comparisonResults.waterDelta).toFixed(1)}% water
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center font-mono text-amber-400 font-bold">C</div>
                        <div>
                          <span className="text-slate-500">Carbon Footprint Difference:</span>{" "}
                          <span className={comparisonResults.carbonDelta < 0 ? "text-mint-400" : "text-amber-500"}>
                            {comparisonResults.carbonDelta < 0 ? "Config B saves" : "Config B adds"}{" "}
                            {Math.abs(comparisonResults.carbonDelta).toFixed(1)}% grid carbon
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly Total (Single View or Double View) */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-sm font-bold text-white">
                    {compareMode ? "Monthly Footprints (Estimated Daily Accumulation)" : `Monthly estimate (based on ${usage} queries/day)`}
                  </div>
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {/* Monthly Config A */}
                    <div className="space-y-3">
                      {compareMode && (
                        <div className="text-[10px] font-bold text-aqua-400 uppercase tracking-widest border-b border-white/5 pb-1">
                          Config A Monthly
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="font-mono text-cyan-400 font-semibold">Water:</div>
                          <div className="font-bold text-white">
                            ~{estimatesA.monthlyWaterMin.toFixed(1)} to {estimatesA.monthlyWaterMax.toFixed(1)} Liters
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="font-mono text-amber-400 font-semibold">Carbon:</div>
                          <div className="font-bold text-white">
                            ~{estimatesA.monthlyCarbonMin < 1000 ? `${estimatesA.monthlyCarbonMin.toFixed(0)} to ${estimatesA.monthlyCarbonMax.toFixed(0)} g` : `${(estimatesA.monthlyCarbonMin / 1000).toFixed(2)} to ${(estimatesA.monthlyCarbonMax / 1000).toFixed(2)} kg`} CO₂e
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Config B */}
                    {compareMode && (
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest border-b border-white/5 pb-1">
                          Config B Monthly
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 text-xs">
                            <div className="font-mono text-cyan-400 font-semibold">Water:</div>
                            <div className="font-bold text-white">
                              ~{estimatesB.monthlyWaterMin.toFixed(1)} to {estimatesB.monthlyWaterMax.toFixed(1)} Liters
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="font-mono text-amber-400 font-semibold">Carbon:</div>
                            <div className="font-bold text-white">
                              ~{estimatesB.monthlyCarbonMin < 1000 ? `${estimatesB.monthlyCarbonMin.toFixed(0)} to ${estimatesB.monthlyCarbonMax.toFixed(0)} g` : `${(estimatesB.monthlyCarbonMin / 1000).toFixed(2)} to ${(estimatesB.monthlyCarbonMax / 1000).toFixed(2)} kg`} CO₂e
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info parameters details */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 text-xs border-t border-white/5 pt-4">
                  <div>
                    <span className="text-slate-500">Closest Center A:</span>{" "}
                    <span className="font-medium text-white">{activeParamsA.regionName}</span>{" "}
                    <span className="text-[10px] text-slate-500">({activeParamsA.waterStress.toFixed(1)} stress)</span>
                  </div>
                  {compareMode && (
                    <div>
                      <span className="text-slate-500">Closest Center B:</span>{" "}
                      <span className="font-medium text-white">{activeParamsB.regionName}</span>{" "}
                      <span className="text-[10px] text-slate-500">({activeParamsB.waterStress.toFixed(1)} stress)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer and Reason */}
              <div className="mt-8">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-slate-400">
                  <strong className="text-amber-300">Disclaimer:</strong> This is a modeled estimate based on public research and infrastructure assumptions. Actual usage varies by model, routing, data center, cooling system, grid mix, and response length.
                </div>

                <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                  <strong>How we estimate:</strong> Query-level estimates are research-based modeled ranges, not audited measurements. The calculation uses published data-center efficiency metrics such as PUE and WUE, public grid carbon-intensity data, estimated model compute demand, response length, and regional cooling assumptions. Exact values for commercial systems like ChatGPT are not publicly verifiable because model routing, hardware utilization, batching, data-center location, and cooling systems are proprietary. Query calculations scale with model parameter size, response length, hardware PUE, often around 1.1–1.3 for efficient hyperscale data centers, but higher in less efficient facilities, water use efficiency (WUE) of region data centers, and local power grid sources.
                </div>

                <div className="mt-4 border-t border-white/5 pt-4 text-xs text-slate-500">
                  <span className="font-semibold text-slate-400 block mb-1">Citations &amp; Reference Sources:</span>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>
                      <a href="https://arxiv.org/abs/2304.03271" target="_blank" rel="noreferrer" className="hover:text-aqua-400 underline">
                        Making AI Less &ldquo;Thirsty&rdquo;: Islam et al.
                      </a>
                    </li>
                    <li>
                      <span className="text-slate-400 font-medium">The Green Grid:</span> Water Usage Effectiveness (WUE) &amp; PUE metric backgrounds
                    </li>
                    <li>
                      <span className="text-slate-400 font-medium">IEA / US eGRID:</span> Grid carbon intensity data
                    </li>
                    <li>
                      <span className="text-slate-400 font-medium">Environmental load balancing</span> for distributed AI inference scheduling
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
