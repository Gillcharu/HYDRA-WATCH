import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useParams } from "react-router-dom";
import { FadeIn } from "../components/AnimatedCounter";
import { api } from "../lib/api";
import type { Region } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

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

function formatEstimatorWater(minL: number, maxL: number): string {
  const minGal = minL * 0.264172;
  const maxGal = maxL * 0.264172;
  return `${minL.toFixed(1)} to ${maxL.toFixed(1)} L (${minGal.toFixed(1)} to ${maxGal.toFixed(1)} gal)`;
}

function formatEstimatorCarbon(minG: number, maxG: number): string {
  if (minG < 1000) {
    const minOz = minG * 0.035274;
    const maxOz = maxG * 0.035274;
    return `${minG.toFixed(0)} to ${maxG.toFixed(0)} g (${minOz.toFixed(1)} to ${maxOz.toFixed(1)} oz)`;
  } else {
    const minKg = minG / 1000;
    const maxKg = maxG / 1000;
    const minLbs = minKg * 2.20462;
    const maxLbs = maxKg * 2.20462;
    return `${minKg.toFixed(2)} to ${maxKg.toFixed(2)} kg (${minLbs.toFixed(1)} to ${maxLbs.toFixed(1)} lbs)`;
  }
}

// User location coordinates mapped from GLOBAL_USER_LOCATIONS fallback list
const USER_COORDS: Record<string, [number, number]> = {
  "Mumbai, India": [19.08, 72.88],
  "Delhi, India": [28.61, 77.21],
  "Singapore": [1.35, 103.82],
  "Tokyo, Japan": [35.68, 139.69],
  "Sydney, Australia": [-33.87, 151.21],
  "London, UK": [51.51, -0.13],
  "Frankfurt, Germany": [50.11, 8.68],
  "Paris, France": [48.86, 2.35],
  "Stockholm, Sweden": [59.33, 18.07],
  "New York, USA": [40.71, -74.01],
  "Virginia, USA": [39.04, -77.49],
  "California, USA": [37.34, -121.89]
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

function formatWaterRange(minLiters: number, maxLiters: number): string {
  if (maxLiters < 1) {
    return `~${(minLiters * 1000).toFixed(0)} to ${(maxLiters * 1000).toFixed(0)} mL`;
  }
  if (minLiters < 1) {
    return `~${(minLiters * 1000).toFixed(0)} mL to ${maxLiters.toFixed(2)} L`;
  }
  return `~${minLiters.toFixed(2)} to ${maxLiters.toFixed(2)} L`;
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex cursor-help items-center justify-center rounded-full bg-slate-200 h-3.5 w-3.5 text-[9px] font-bold text-slate-500 hover:bg-slate-300 hover:text-slate-900">
      ?
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-slate-900 bg-slate-900 p-2 text-[10px] font-normal leading-normal text-white opacity-0 shadow-xl transition duration-200 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-transparent bg-slate-900 p-3 text-[10px] font-sans shadow-xl text-white">
        <p className="font-bold text-white mb-1">{data.name} Footprint</p>
        <div className="space-y-0.5 font-mono">
          <p className="text-cyan-300">Config A: {payload[0].value} {data.unit}</p>
          <p className="text-emerald-400">Config B: {payload[1].value} {data.unit}</p>
        </div>
      </div>
    );
  }
  return null;
};


export function PersonalEstimatorPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode and form states
  const [compareMode, setCompareMode] = useState(() => searchParams.get("compare") === "true");

  // Config A States
  const [aiTool, setAiTool] = useState(() => searchParams.get("tool") || "ChatGPT");
  const [usage, setUsage] = useState(() => Number(searchParams.get("usage")) || 10);
  const [promptType, setPromptType] = useState(() => searchParams.get("type") || "simple");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number; name: string } | null>(() => {
    const name = searchParams.get("loc");
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    if (name && lat && lon) {
      return { name, lat: Number(lat), lon: Number(lon) };
    }
    return null;
  });

  // Config B States (Comparison mode)
  const [aiToolB, setAiToolB] = useState(() => searchParams.get("toolB") || "Gemini");
  const [usageB, setUsageB] = useState(() => Number(searchParams.get("usageB")) || 10);
  const [promptTypeB, setPromptTypeB] = useState(() => searchParams.get("typeB") || "simple");
  const [locationCoordsB, setLocationCoordsB] = useState<{ lat: number; lon: number; name: string } | null>(() => {
    const name = searchParams.get("locB");
    const lat = searchParams.get("latB");
    const lon = searchParams.get("lonB");
    if (name && lat && lon) {
      return { name, lat: Number(lat), lon: Number(lon) };
    }
    return null;
  });

  // Autocomplete search inputs and suggestions state
  const [locQueryA, setLocQueryA] = useState("");
  const [suggestionsA, setSuggestionsA] = useState<any[]>([]);
  const [loadingLocA, setLoadingLocA] = useState(false);

  const [locQueryB, setLocQueryB] = useState("");
  const [suggestionsB, setSuggestionsB] = useState<any[]>([]);
  const [loadingLocB, setLoadingLocB] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.regions().then((d) => setRegions(d.regions)).catch(console.error);
  }, []);

  // Debounce Location A OSM Nominatim Search
  useEffect(() => {
    if (locQueryA.trim().length < 3) {
      setSuggestionsA([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      setLoadingLocA(true);
      fetch(`/api/geocode?q=${encodeURIComponent(locQueryA)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSuggestionsA(data);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingLocA(false));
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [locQueryA]);

  // Debounce Location B OSM Nominatim Search
  useEffect(() => {
    if (locQueryB.trim().length < 3) {
      setSuggestionsB([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      setLoadingLocB(true);
      fetch(`/api/geocode?q=${encodeURIComponent(locQueryB)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSuggestionsB(data);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingLocB(false));
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [locQueryB]);

  const { id } = useParams<{ id: string }>();
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [errorEstimate, setErrorEstimate] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Load shared estimate configuration if short ID is present
  useEffect(() => {
    if (!id) return;
    setLoadingEstimate(true);
    setErrorEstimate(null);
    fetch(`/api/estimates/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Shared estimate not found");
        }
        return res.json();
      })
      .then((data) => {
        const config = data.config_data;
        if (config) {
          setCompareMode(config.compare === "true" || config.compare === true);
          if (config.tool) setAiTool(config.tool);
          if (config.usage !== undefined) setUsage(Number(config.usage) || 10);
          if (config.type) setPromptType(config.type);
          if (config.loc && config.lat !== undefined && config.lon !== undefined) {
            setLocationCoords({
              name: config.loc,
              lat: Number(config.lat),
              lon: Number(config.lon),
            });
          } else {
            setLocationCoords(null);
          }

          if (config.toolB) setAiToolB(config.toolB);
          if (config.usageB !== undefined) setUsageB(Number(config.usageB) || 10);
          if (config.typeB) setPromptTypeB(config.typeB);
          if (config.locB && config.latB !== undefined && config.lonB !== undefined) {
            setLocationCoordsB({
              name: config.locB,
              lat: Number(config.latB),
              lon: Number(config.lonB),
            });
          } else {
            setLocationCoordsB(null);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorEstimate(err.message || "Failed to load shared estimate");
      })
      .finally(() => {
        setLoadingEstimate(false);
      });
  }, [id]);

  // Sync state changes to search parameters
  useEffect(() => {
    if (id) return; // Do not overwrite search params if viewing a short estimate
    const params: Record<string, string> = {
      compare: compareMode.toString(),
      tool: aiTool,
      usage: usage.toString(),
      type: promptType,
    };
    if (locationCoords) {
      params.loc = locationCoords.name;
      params.lat = locationCoords.lat.toString();
      params.lon = locationCoords.lon.toString();
    }
    if (compareMode) {
      params.toolB = aiToolB;
      params.usageB = usageB.toString();
      params.typeB = promptTypeB;
      if (locationCoordsB) {
        params.locB = locationCoordsB.name;
        params.latB = locationCoordsB.lat.toString();
        params.lonB = locationCoordsB.lon.toString();
      }
    }
    setSearchParams(params, { replace: true });
  }, [
    id,
    compareMode,
    aiTool,
    usage,
    promptType,
    locationCoords,
    aiToolB,
    usageB,
    promptTypeB,
    locationCoordsB,
    setSearchParams,
  ]);

  const handleShare = () => {
    if (sharing) return;
    setSharing(true);

    const config: Record<string, any> = {
      compare: compareMode,
      tool: aiTool,
      usage: usage,
      type: promptType,
    };
    if (locationCoords) {
      config.loc = locationCoords.name;
      config.lat = locationCoords.lat;
      config.lon = locationCoords.lon;
    }
    if (compareMode) {
      config.toolB = aiToolB;
      config.usageB = usageB;
      config.typeB = promptTypeB;
      if (locationCoordsB) {
        config.locB = locationCoordsB.name;
        config.latB = locationCoordsB.lat;
        config.lonB = locationCoordsB.lon;
      }
    }

    fetch("/api/estimates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server error saving estimate");
        return res.json();
      })
      .then((data) => {
        const shareUrl = `${window.location.protocol}//${window.location.host}/e/${data.id}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to generate short link:", err);
        // Fallback to copying standard query parameters URL
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .finally(() => {
        setSharing(false);
      });
  };

  // Helper to resolve region parameters based on geocoded user location coordinates
  const getActiveParams = (coordsObj: { lat: number; lon: number; name: string } | null) => {
    if (!coordsObj || regions.length === 0) {
      return {
        carbonIntensityMin: 0.30,
        carbonIntensityMax: 0.55,
        waterStress: 2.5,
        regionName: "Global Average Grid",
        wueMin: 0.4,
        wueMax: 1.2,
      };
    }

    const { lat, lon } = coordsObj;
    let closestRegion: Region | null = null;
    let minDistance = Infinity;

    regions.forEach((r) => {
      const coords = REGION_COORDS[r.region_code];
      if (coords) {
        const [rLat, rLon] = coords;
        const dist = haversineDistance(lat, lon, rLat, rLon);
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
      regionName: `${reg.provider} · ${formatRegionDisplayName(reg.region_code, reg.region_name, reg.country, reg.city)}`,
      wueMin: stress > 3.5 ? 0.8 : 0.2,
      wueMax: stress > 3.5 ? 1.6 : 0.9,
    };
  };

  const activeParamsA = useMemo(() => getActiveParams(locationCoords), [locationCoords, regions]);
  const activeParamsB = useMemo(() => getActiveParams(locationCoordsB), [locationCoordsB, regions]);

  // Main calculation engine
  const calculateFootprint = (
    tool: string,
    type: string,
    promptsPerDay: number,
    locParams: ReturnType<typeof getActiveParams>,
    coordsObj: { lat: number; lon: number; name: string } | null
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
    if (coordsObj) {
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
    return calculateFootprint(aiTool, promptType, usage, activeParamsA, locationCoords);
  }, [aiTool, promptType, usage, activeParamsA, locationCoords]);

  const estimatesB = useMemo(() => {
    return calculateFootprint(aiToolB, promptTypeB, usageB, activeParamsB, locationCoordsB);
  }, [aiToolB, promptTypeB, usageB, activeParamsB, locationCoordsB]);

  const chartData = useMemo(() => {
    return [
      {
        name: "Water",
        A: Math.round(((estimatesA.waterMin + estimatesA.waterMax) / 2) * 1000),
        B: Math.round(((estimatesB.waterMin + estimatesB.waterMax) / 2) * 1000),
        unit: "mL",
      },
      {
        name: "Carbon",
        A: Number(((estimatesA.carbonMin + estimatesA.carbonMax) / 2).toFixed(1)),
        B: Number(((estimatesB.carbonMin + estimatesB.carbonMax) / 2).toFixed(1)),
        unit: "g CO₂e",
      },
      {
        name: "Energy",
        A: Number(((estimatesA.energyMin + estimatesA.energyMax) / 2).toFixed(1)),
        B: Number(((estimatesB.energyMin + estimatesB.energyMax) / 2).toFixed(1)),
        unit: "Wh",
      },
    ];
  }, [estimatesA, estimatesB]);

  // Tangible environmental equivalency helper
  const getEquivalencies = (energy: number, carbon: number, water: number) => {
    const bulbHrs = energy / 9;
    const bulbDisplay = bulbHrs >= 1 ? `${bulbHrs.toFixed(1)} hrs` : `${(bulbHrs * 60).toFixed(0)} mins`;

    const carMeters = (carbon / 120) * 1000;
    const carDisplay = carMeters >= 1000 ? `${(carMeters / 1000).toFixed(2)} km` : `${carMeters.toFixed(0)} meters`;

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

  if (loadingEstimate) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 sm:px-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-500 font-mono">Loading shared estimate...</p>
      </div>
    );
  }

  if (errorEstimate) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 sm:px-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-red-600 text-3xl mb-4">⚠️</div>
        <p className="text-sm text-slate-700 font-display font-semibold">{errorEstimate}</p>
        <button
          onClick={() => window.location.href = "/personal-estimator"}
          className="mt-6 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          Go to Estimator
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5">
              <span className="font-mono text-xs font-medium text-teal-600">
                For Individuals
              </span>
            </div>
            <h1 className="headline mt-4 text-slate-900">Personal AI Use Estimator</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              How much water, electricity, and carbon does a single LLM or image prompt consume? Customize your typical tool, location, and queries to explore the environmental cost of individual AI interactions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Compare Mode Toggle */}
            <button
              onClick={() => setCompareMode((c) => !c)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition ${
                compareMode
                  ? "bg-slate-900 border-transparent text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {compareMode ? "Side-by-Side Active" : "Compare Mode"}
            </button>

            {/* Share link button */}
            <button
              onClick={handleShare}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition duration-200 ${
                copied
                  ? "bg-emerald-600 border-transparent text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {copied ? "Link Copied!" : "Share Estimate"}
            </button>
          </div>
        </div>
      </FadeIn>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* Forms Card Container */}
        <div className={compareMode ? "lg:col-span-12 grid gap-6 md:grid-cols-2" : "lg:col-span-5"}>
          {/* CONFIGURATION A */}
          <FadeIn delay={0.1}>
            <div className={`glass rounded-2xl p-6 md:p-8 h-full bg-white border border-slate-200 shadow-sm transition-all ${compareMode ? "border-teal-300 ring-1 ring-teal-100" : ""}`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {compareMode ? "Configuration A" : "Estimate Settings"}
                </h2>
                {compareMode && (
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse" />
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
                          ? "bg-slate-900 border-transparent text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-950"
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
                          ? "bg-slate-100 border-slate-900 text-slate-900 ring-1 ring-slate-900/10 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="text-xs font-bold">{type.label}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Search Input */}
              <div className="mb-6 relative">
                <label className="label-dark flex items-center" htmlFor="location-search-a">
                  Your Location (Optional)
                  <Tooltip text="Type any city or country in the world. We dynamically resolve it using geocoding to find the closest cloud datacenter region and its local watershed stress/grid carbon factors." />
                </label>
                <div className="relative">
                  <input
                    id="location-search-a"
                    type="text"
                    placeholder={locationCoords ? locationCoords.name : "Search any city or country (e.g. Paris, Tokyo)..."}
                    value={locQueryA}
                    onChange={(e) => setLocQueryA(e.target.value)}
                    className="input-dark pr-10"
                  />
                  {loadingLocA && (
                    <div className="absolute right-3 top-3 h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  )}
                  {locationCoords && !locQueryA && (
                    <button
                      onClick={() => {
                        setLocationCoords(null);
                        setLocQueryA("");
                      }}
                      className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-800"
                      title="Clear location"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* Suggestions Dropdown */}
                {suggestionsA.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {suggestionsA.map((item) => (
                      <button
                        key={item.place_id}
                        onClick={() => {
                          setLocationCoords({
                            lat: parseFloat(item.lat),
                            lon: parseFloat(item.lon),
                            name: item.display_name.split(",").slice(0, 3).join(","),
                          });
                          setLocQueryA("");
                          setSuggestionsA([]);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-0 bg-white"
                      >
                        {item.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {locationCoords && (
                  <div className="mt-2 text-[10px] text-teal-600 font-mono flex items-center gap-1.5">
                    <span>Mapped: {locationCoords.name} ({locationCoords.lat.toFixed(2)}, {locationCoords.lon.toFixed(2)})</span>
                  </div>
                )}
              </div>

              {/* Usage Frequency */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-dark !mb-0 flex items-center" htmlFor="prompts-slider-a">
                    Daily AI Prompts
                    <Tooltip text="Adjust the slider to scale your daily prompt queries to a cumulative monthly footprint." />
                  </label>
                  <span className="font-mono text-xs font-bold text-teal-600">
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
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-600 focus:outline-none"
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
                <div className="glass bg-white border border-slate-200 shadow-sm border-emerald-300 ring-1 ring-emerald-100 rounded-2xl p-6 md:p-8 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">Configuration B</h2>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
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
                              ? "bg-slate-900 border-transparent text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-950"
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
                              ? "bg-slate-100 border-slate-900 text-slate-900 ring-1 ring-slate-900/10 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <span className="text-xs font-bold">{type.label}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5">{type.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location Search Input */}
                  <div className="mb-6 relative">
                    <label className="label-dark flex items-center" htmlFor="location-search-b">
                      Your Location (Optional)
                      <Tooltip text="Type any city or country in the world. We dynamically resolve it using geocoding to find the closest cloud datacenter region and its local watershed stress/grid carbon factors." />
                    </label>
                    <div className="relative">
                      <input
                        id="location-search-b"
                        type="text"
                        placeholder={locationCoordsB ? locationCoordsB.name : "Search any city or country (e.g. Paris, Tokyo)..."}
                        value={locQueryB}
                        onChange={(e) => setLocQueryB(e.target.value)}
                        className="input-dark pr-10"
                      />
                      {loadingLocB && (
                        <div className="absolute right-3 top-3 h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      )}
                      {locationCoordsB && !locQueryB && (
                        <button
                          onClick={() => {
                            setLocationCoordsB(null);
                            setLocQueryB("");
                          }}
                          className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-800"
                          title="Clear location"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {/* Suggestions Dropdown */}
                    {suggestionsB.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {suggestionsB.map((item) => (
                          <button
                            key={item.place_id}
                            onClick={() => {
                              setLocationCoordsB({
                                lat: parseFloat(item.lat),
                                lon: parseFloat(item.lon),
                                name: item.display_name.split(",").slice(0, 3).join(","),
                              });
                              setLocQueryB("");
                              setSuggestionsB([]);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-0 bg-white"
                          >
                            {item.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                    {locationCoordsB && (
                      <div className="mt-2 text-[10px] text-emerald-600 font-mono flex items-center gap-1.5">
                        <span>Mapped: {locationCoordsB.name} ({locationCoordsB.lat.toFixed(2)}, {locationCoordsB.lon.toFixed(2)})</span>
                      </div>
                    )}
                  </div>

                  {/* Usage Frequency */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-dark !mb-0 flex items-center" htmlFor="prompts-slider-b">
                        Daily AI Prompts
                        <Tooltip text="Adjust the slider to scale your daily prompt queries to a cumulative monthly footprint." />
                      </label>
                      <span className="font-mono text-xs font-bold text-emerald-600">
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
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 focus:outline-none"
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
            <div className="glass rounded-2xl p-6 md:p-8 flex flex-col justify-between h-full bg-white border border-slate-200 shadow-sm text-slate-800">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 mb-6">Estimated Impact</h2>

                {/* Estimation Values Grid */}
                <div className={compareMode ? "grid gap-6 md:grid-cols-2" : "space-y-6"}>
                  {/* CONFIG A (AND REGULAR MODE) DISPLAY */}
                  <div className={`space-y-4 ${compareMode ? "border-r border-slate-200 pr-6" : ""}`}>
                    {compareMode && (
                      <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" /> Config A ({aiTool})
                      </div>
                    )}
                    <div className={`grid gap-3 ${compareMode ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
                      {/* Water */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-cyan-800 flex items-center">
                          Water per query
                          <Tooltip text="Direct site water used for evaporative cooling plus indirect water consumed at regional power plants during electricity generation." />
                        </div>
                        <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                          {formatWaterRange(estimatesA.waterMin, estimatesA.waterMax)}
                        </div>
                      </div>

                      {/* Carbon */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-amber-800 flex items-center">
                          Carbon per query
                          <Tooltip text="Equivalent grid carbon emissions (g CO2e) generated from power plant energy grid sources matching the datacenter's location." />
                        </div>
                        <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                          ~{estimatesA.carbonMin.toFixed(2)} to {estimatesA.carbonMax.toFixed(2)} g CO₂e
                        </div>
                      </div>

                      {/* Energy */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                        <div className="text-xs font-semibold text-teal-700 flex items-center">
                          Energy per query
                          <Tooltip text="Total electricity (Wh) consumed by the GPU server hardware, including datacenter PUE (overhead cooling/lighting factors)." />
                        </div>
                        <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                          ~{estimatesA.energyMin.toFixed(2)} to {estimatesA.energyMax.toFixed(2)} Wh
                        </div>
                      </div>
                    </div>

                    {/* Equivalencies (Section 2) */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="text-xs font-bold text-slate-600 border-b border-slate-200 pb-2 mb-2 uppercase tracking-wide">
                        Query Equivalencies
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div>
                          <div className="text-slate-500">LED Bulb</div>
                          <div className="font-mono font-bold text-slate-800 mt-1">{equivsA.bulbDisplay}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Gas Car</div>
                          <div className="font-mono font-bold text-slate-800 mt-1">{equivsA.carDisplay}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Tap Flow</div>
                          <div className="font-mono font-bold text-slate-800 mt-1">{equivsA.tapDisplay}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONFIG B DISPLAY (Visible only in compareMode) */}
                  {compareMode && (
                    <div className="space-y-4 pl-2">
                      <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" /> Config B ({aiToolB})
                      </div>
                      <div className="grid gap-3 grid-cols-1">
                        {/* Water */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-cyan-800 flex items-center">
                            Water per query
                            <Tooltip text="Direct site water used for evaporative cooling plus indirect water consumed at regional power plants during electricity generation." />
                          </div>
                          <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                            {formatWaterRange(estimatesB.waterMin, estimatesB.waterMax)}
                          </div>
                        </div>

                        {/* Carbon */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-amber-800 flex items-center">
                            Carbon per query
                            <Tooltip text="Equivalent grid carbon emissions (g CO2e) generated from power plant energy grid sources matching the datacenter's location." />
                          </div>
                          <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                            ~{estimatesB.carbonMin.toFixed(2)} to {estimatesB.carbonMax.toFixed(2)} g CO₂e
                          </div>
                        </div>

                        {/* Energy */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                          <div className="text-xs font-semibold text-emerald-700 flex items-center">
                            Energy per query
                            <Tooltip text="Total electricity (Wh) consumed by the GPU server hardware, including datacenter PUE (overhead cooling/lighting factors)." />
                          </div>
                          <div className="font-display text-lg font-bold text-slate-800 mt-1.5">
                            ~{estimatesB.energyMin.toFixed(2)} to {estimatesB.energyMax.toFixed(2)} Wh
                          </div>
                        </div>
                      </div>

                      {/* Equivalencies (Section 2) */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-bold text-slate-600 border-b border-slate-200 pb-2 mb-2 uppercase tracking-wide">
                          Query Equivalencies
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <div className="text-slate-500">LED Bulb</div>
                            <div className="font-mono font-bold text-slate-800 mt-1">{equivsB.bulbDisplay}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Gas Car</div>
                            <div className="font-mono font-bold text-slate-800 mt-1">{equivsB.carDisplay}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Tap Flow</div>
                            <div className="font-mono font-bold text-slate-800 mt-1">{equivsB.tapDisplay}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compare Mode Delta Card */}
                {compareMode && comparisonResults && (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1">
                      <span>Comparison Analysis</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs font-semibold">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-cyan-50 flex items-center justify-center font-mono text-cyan-700 font-bold border border-cyan-200">W</div>
                        <div>
                          <span className="text-slate-600">Water Footprint Difference:</span>{" "}
                          <span className={comparisonResults.waterDelta < 0 ? "text-emerald-700" : "text-amber-700"}>
                            {comparisonResults.waterDelta < 0 ? "Config B saves" : "Config B adds"}{" "}
                            {Math.abs(comparisonResults.waterDelta).toFixed(1)}% water
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center font-mono text-amber-700 font-bold border border-amber-200">C</div>
                        <div>
                          <span className="text-slate-600">Carbon Footprint Difference:</span>{" "}
                          <span className={comparisonResults.carbonDelta < 0 ? "text-emerald-700" : "text-amber-700"}>
                            {comparisonResults.carbonDelta < 0 ? "Config B saves" : "Config B adds"}{" "}
                            {Math.abs(comparisonResults.carbonDelta).toFixed(1)}% grid carbon
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Comparison Chart */}
                    <div className="mt-6 h-48 w-full border-t border-slate-200 pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="A" fill="#0d9488" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="B" fill="#059669" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Monthly Total (Single View or Double View) */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-bold text-slate-900">
                    {compareMode ? "Monthly Footprints (Estimated Daily Accumulation)" : `Monthly estimate (based on ${usage} queries/day)`}
                  </div>
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {/* Monthly Config A */}
                    <div className="space-y-3">
                      {compareMode && (
                        <div className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-200 pb-1">
                          Config A Monthly
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="font-mono text-cyan-800 font-semibold">Water:</div>
                          <div className="font-bold text-slate-800">
                            ~{formatEstimatorWater(estimatesA.monthlyWaterMin, estimatesA.monthlyWaterMax)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="font-mono text-amber-800 font-semibold">Carbon:</div>
                          <div className="font-bold text-slate-800">
                            ~{formatEstimatorCarbon(estimatesA.monthlyCarbonMin, estimatesA.monthlyCarbonMax)} CO₂e
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Config B */}
                    {compareMode && (
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest border-b border-slate-200 pb-1">
                          Config B Monthly
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 text-xs">
                            <div className="font-mono text-cyan-800 font-semibold">Water:</div>
                            <div className="font-bold text-slate-800">
                              ~{formatEstimatorWater(estimatesB.monthlyWaterMin, estimatesB.monthlyWaterMax)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="font-mono text-amber-800 font-semibold">Carbon:</div>
                            <div className="font-bold text-slate-800">
                              ~{formatEstimatorCarbon(estimatesB.monthlyCarbonMin, estimatesB.monthlyCarbonMax)} CO₂e
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info parameters details */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 text-xs border-t border-slate-200 pt-4">
                  <div>
                    <span className="text-slate-500">Closest Center A:</span>{" "}
                    <span className="font-medium text-slate-800">{activeParamsA.regionName}</span>{" "}
                    <span className="text-[10px] text-slate-500">({activeParamsA.waterStress.toFixed(1)} stress)</span>
                  </div>
                  {compareMode && (
                    <div>
                      <span className="text-slate-500">Closest Center B:</span>{" "}
                      <span className="font-medium text-slate-800">{activeParamsB.regionName}</span>{" "}
                      <span className="text-[10px] text-slate-500">({activeParamsB.waterStress.toFixed(1)} stress)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer and Reason */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-slate-700">
                  <strong className="text-amber-900">Disclaimer:</strong> This is a modeled estimate based on public research and infrastructure assumptions. Actual usage varies by model, routing, data center, cooling system, grid mix, and response length.
                </div>

                <div className="mt-4 text-xs text-slate-600 leading-relaxed">
                  <strong>How we estimate:</strong> Query-level estimates are research-based modeled ranges, not audited measurements. The calculation uses published data-center efficiency metrics such as PUE and WUE, public grid carbon-intensity data, estimated model compute demand, response length, and regional cooling assumptions. Exact values for commercial systems like ChatGPT are not publicly verifiable because model routing, hardware utilization, batching, data-center location, and cooling systems are proprietary. Query calculations scale with model parameter size, response length, hardware PUE, often around 1.1–1.3 for efficient hyperscale data centers, but higher in less efficient facilities, water use efficiency (WUE) of region data centers, and local power grid sources.
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700 block mb-1">Citations &amp; Reference Sources:</span>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>
                      <a href="https://arxiv.org/abs/2304.03271" target="_blank" rel="noreferrer" className="hover:text-teal-600 underline">
                        Making AI Less &ldquo;Thirsty&rdquo;: Islam et al.
                      </a>
                    </li>
                    <li>
                      <span className="text-slate-700 font-medium">The Green Grid:</span> Water Usage Effectiveness (WUE) &amp; PUE metric backgrounds
                    </li>
                    <li>
                      <span className="text-slate-700 font-medium">IEA / US eGRID:</span> Grid carbon intensity data
                    </li>
                    <li>
                      <span className="text-slate-700 font-medium">Environmental load balancing</span> for distributed AI inference scheduling
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
