import { motion } from "framer-motion";

export function MeshBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-slate-50" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-60" />
      <motion.div
        className="absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh] rounded-full bg-indigo-200/30 blur-[120px] animate-mesh-drift"
        aria-hidden
      />
      <motion.div
        className="absolute -bottom-1/4 -right-1/4 h-[60vh] w-[60vh] rounded-full bg-cyan-100/35 blur-[100px] animate-mesh-drift"
        style={{ animationDelay: "-6s" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/10 to-slate-50" />
    </div>
  );
}
