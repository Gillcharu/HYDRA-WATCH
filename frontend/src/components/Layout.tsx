import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MeshBackground } from "./MeshBackground";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/platform", label: "Platform" },
  { to: "/regions", label: "Regions" },
  { to: "/leaderboard", label: "Rankings" },
  { to: "/trust", label: "Trust" },
  { to: "/personal-estimator", label: "Estimator" },
];

export function Layout() {
  const { pathname } = useLocation();
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setIsWarmingUp(true);
    }, 1500);

    fetch("/api/meta", { signal: controller.signal })
      .then(() => {
        clearTimeout(timeoutId);
        setIsWarmingUp(false);
      })
      .catch(() => {
        // Ignore errors
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col">
      <MeshBackground />

      {isWarmingUp && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-2.5 px-4 text-xs font-mono">
          ⚡ Server is warming up — this takes ~30 seconds on the Render Free Tier. Thank you for your patience!
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white transition group-hover:scale-105">
              H
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">HydraWatch</span>
              <span className="hidden text-[10px] text-slate-500 sm:block">AI Infrastructure Intelligence</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                  pathname === to ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {pathname === to && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-slate-200/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative">{label}</span>
              </Link>
            ))}
            <a href="/docs" target="_blank" rel="noreferrer" className="ml-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              API ↗
            </a>
            <Link to="/platform" className="btn-glow ml-3 !py-2 !text-xs">
              Open platform
            </Link>
          </nav>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-slate-200 px-4 py-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                pathname === to ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="relative flex-1">
        <Outlet />
      </main>

      <footer className="relative border-t border-slate-200 bg-slate-100/80 py-12 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">HydraWatch</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Pick a model and region. See how much water and carbon your workload uses.
            </p>
          </div>
          <div>
            <div className="section-label">Platform</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
              <Link to="/platform" className="hover:text-slate-900">Workload analysis</Link>
              <Link to="/regions" className="hover:text-slate-900">121 cloud regions</Link>
              <Link to="/leaderboard" className="hover:text-slate-900">Global rankings</Link>
              <Link to="/trust" className="hover:text-slate-900">Verification ladder</Link>
            </div>
          </div>
          <div>
            <div className="section-label">Methodology & Feedback</div>
            <p className="mt-3 text-sm text-slate-600">
              v3.0 · MLPerf energy · IEA/eGRID carbon · V0–V4 trust tiers · MIT License
            </p>
            <p className="mt-2 text-xs text-slate-500 leading-normal">
              Built by Charu Gill · B.Tech CS/AI, JUIT · <a href="mailto:241033061@juitsolan.in" className="underline hover:text-slate-900">241033061@juitsolan.in</a>
            </p>
            <div className="mt-4 flex gap-4 text-xs text-slate-600">
              <a href="https://github.com/Gillcharu/HYDRA-WATCH" target="_blank" rel="noreferrer" className="hover:text-slate-900">Feedback / GitHub</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-slate-200 px-4 pt-6 text-center text-xs text-slate-500 sm:px-6">
          © 2026 HydraWatch · Decision support, not audited ESG certification
        </div>
      </footer>
    </div>
  );
}
