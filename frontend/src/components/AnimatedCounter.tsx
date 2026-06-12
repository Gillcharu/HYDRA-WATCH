import { useEffect, useState, type ReactNode } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());
  const [text, setText] = useState("0");

  useEffect(() => {
    spring.set(value);
    return display.on("change", (v) => setText(String(v)));
  }, [value, spring, display]);

  return (
    <span className="tabular-nums">
      {text}
      {suffix}
    </span>
  );
}

export function FadeIn({
  children,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
