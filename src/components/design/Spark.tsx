/**
 * Sparkline — animated draw-in path with optional fill, plus a pulsing dot
 * on the last point. Ported from /design/primitives.jsx.
 */

interface SparkProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  delay?: number;
}

export function Spark({
  data,
  color = "#A86F3D",
  width = 80,
  height = 28,
  delay = 0,
}: SparkProps) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts: [number, number][] = data.map((v, i) => [
    i * step,
    height - ((v - min) / span) * (height - 4) - 2,
  ]);
  const d = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const last = pts[pts.length - 1];
  const gid = `g${color.replace("#", "")}`;
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${width},${height} L0,${height} Z`}
        fill={`url(#${gid})`}
        opacity=".7"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkpath"
        style={{ ["--len" as any]: len, animationDelay: `${delay}s` }}
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} opacity=".95">
        <animate
          attributeName="r"
          values="2;3.5;2"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
