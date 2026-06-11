import { motion } from "framer-motion";

export function MeshBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-abyss-950" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-40" />
      <motion.div
        className="absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh] rounded-full bg-aqua-600/20 blur-[120px] animate-mesh-drift"
        aria-hidden
      />
      <motion.div
        className="absolute -bottom-1/4 -right-1/4 h-[60vh] w-[60vh] rounded-full bg-mint-500/15 blur-[100px] animate-mesh-drift"
        style={{ animationDelay: "-6s" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-abyss-950/50 to-abyss-950" />
    </div>
  );
}
