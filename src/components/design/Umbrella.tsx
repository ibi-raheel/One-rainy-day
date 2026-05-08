/** Brand mark — umbrella + raindrops in cream/cognac/teal. */
export function Umbrella({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="#F4EAD3" />
      <path d="M10 33 C10 21 19 14.5 32 14.5 C45 14.5 54 21 54 33 Z" fill="#A86F3D" />
      <path d="M21 33 C21 25 26 19 32 19 C38 19 43 25 43 33" stroke="#FAF5EA" strokeWidth="1.4" opacity="0.55" fill="none" />
      <path d="M32 14.5 L32 33" stroke="#FAF5EA" strokeWidth="1" opacity="0.45" />
      <path d="M10 33 L54 33" stroke="#8C5A2E" strokeWidth="1" opacity="0.5" />
      <path d="M32 33 L32 47 Q32 53 26 53" stroke="#A86F3D" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="14" cy="48" rx="1.6" ry="2.4" fill="#2D575E" opacity="0.6" />
      <ellipse cx="49" cy="44" rx="1.8" ry="2.8" fill="#2D575E" opacity="0.78" />
      <ellipse cx="56" cy="52" rx="1.4" ry="2" fill="#2D575E" opacity="0.55" />
      <ellipse cx="20" cy="56" rx="1.2" ry="1.8" fill="#2D575E" opacity="0.45" />
    </svg>
  );
}
