import { useMemo } from "react";

/**
 * Rainfield — small per-section rain decoration used inside .page-head.
 * Mounts a fixed count of `.drop` elements with randomized positions.
 * Ported from /design/primitives.jsx.
 */
export function Rainfield({ count = 22 }: { count?: number }) {
  const drops = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 4,
        dur: 1.6 + Math.random() * 2.2,
        height: 8 + Math.random() * 16,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    [count]
  );
  return (
    <div className="rainfield" aria-hidden="true">
      {drops.map((d, i) => (
        <span
          key={i}
          className="drop"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * PageRain — full-window animated rain with depth layers (far/mid/near)
 * and ground-level splash ripples. Mounted once at the top of the app.
 */
export function PageRain({ count = 90 }: { count?: number }) {
  const drops = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const layer = Math.random();
        return {
          left: Math.random() * 110 - 5,
          delay: Math.random() * 6,
          dur: 0.8 + Math.random() * 1.6,
          height: 14 + Math.random() * 38,
          layer: layer < 0.35 ? "far" : layer < 0.75 ? "" : "near",
        };
      }),
    [count]
  );
  const splashes = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
      })),
    []
  );
  return (
    <div className="page-rain" aria-hidden="true">
      {drops.map((d, i) => (
        <span
          key={i}
          className={`pdrop ${d.layer}`}
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
      {splashes.map((s, i) => (
        <span
          key={`s${i}`}
          className="splash"
          style={{ left: `${s.left}%`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}
