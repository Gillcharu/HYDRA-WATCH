import { motion } from "framer-motion";

const STEPS = [
  { id: "source", label: "Connect", icon: "01", desc: "Cloud, logs, MLOps" },
  { id: "workload", label: "Detect", icon: "02", desc: "Region, GPU, traffic" },
  { id: "energy", label: "Energy", icon: "03", desc: "MLPerf + TDP" },
  { id: "water", label: "Water", icon: "04", desc: "WUE × facility kWh" },
  { id: "carbon", label: "Carbon", icon: "05", desc: "Grid intensity" },
  { id: "score", label: "Score", icon: "06", desc: "Composite index" },
  { id: "action", label: "Action", icon: "07", desc: "Greener region" },
];

export function PipelineFlow() {
  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-2 md:gap-0">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group relative flex flex-col items-center px-3 md:px-5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] font-mono text-sm font-bold text-aqua-300 shadow-lg transition group-hover:border-aqua-500/40 group-hover:shadow-aqua-500/10">
                {step.icon}
              </div>
              <span className="mt-2 text-xs font-bold text-white">{step.label}</span>
              <span className="mt-0.5 hidden text-[10px] text-slate-500 sm:block">{step.desc}</span>
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className="hidden h-px w-8 bg-gradient-to-r from-aqua-500/50 to-transparent md:block lg:w-12" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
