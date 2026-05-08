import { useEffect, useState } from "react";

interface CountUpProps {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  dur?: number;
  delay?: number;
}

/**
 * Eased numeric count-up. Ported from /design/primitives.jsx.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  dur = 900,
  delay = 0,
}: CountUpProps) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      if (t < t0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur, delay]);
  return (
    <span className="count-up nums">
      {prefix}
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
