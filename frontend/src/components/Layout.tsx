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

  return (
    <div className="relative flex min-h-screen flex-col">
      <MeshBackground />

      <header className="sticky top-0 z-50 border-b border-white/5 bg-abyss-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aqua-500 to-mint-500 text-lg font-bold text-abyss-950 shadow-lg shadow-aqua-500/20 transition group-hover:scale-105">
              H
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-white">HydraWatch</span>
              <span className="hidden text-[10px] text-slate-500 sm:block">AI Infrastructure Intelligence</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                  pathname === to ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {pathname === to && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative">{label}</span>
              </Link>
            ))}
            <a href="/docs" target="_blank" rel="noreferrer" className="ml-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white">
              API ↗
            </a>
            <Link to="/platform" className="btn-glow ml-3 !py-2 !text-xs">
              Open platform
            </Link>
          </nav>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                pathname === to ? "bg-aqua-500 text-abyss-950" : "bg-white/5 text-slate-300"
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

      <footer className="relative border-t border-white/5 bg-abyss-950/80 py-12 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
          <div>
            <div className="font-display text-lg font-bold text-white">HydraWatch</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              The intelligence layer for sustainable AI infrastructure. Water, carbon, and cost — before you deploy.
            </p>
          </div>
          <div>
            <div className="section-label">Platform</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400">
              <Link to="/platform" className="hover:text-aqua-400">Workload analysis</Link>
              <Link to="/regions" className="hover:text-aqua-400">121 cloud regions</Link>
              <Link to="/leaderboard" className="hover:text-aqua-400">Global rankings</Link>
              <Link to="/trust" className="hover:text-aqua-400">Verification ladder</Link>
            </div>
          </div>
          <div>
            <div className="section-label">Methodology & Feedback</div>
            <p className="mt-3 text-sm text-slate-500">
              v3.0 · MLPerf energy · IEA/eGRID carbon · V0–V4 trust tiers · MIT License
            </p>
            <div className="mt-4 flex gap-4 text-xs text-slate-400">
              <a href="mailto:contact@hydrawatch.com" className="hover:text-aqua-400">Contact Us</a>
              <span className="text-slate-700">|</span>
              <a href="https://github.com/Gillcharu/HYDRA-WATCH" target="_blank" rel="noreferrer" className="hover:text-aqua-400">Feedback / GitHub</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/5 px-4 pt-6 text-center text-xs text-slate-600 sm:px-6">
          © 2026 HydraWatch · Decision support, not audited ESG certification
        </div>
      </footer>
    </div>
  );
}
