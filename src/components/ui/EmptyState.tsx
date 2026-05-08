import { type ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ?? <DefaultIllustration />}
      <h3 className="display text-2xl text-text-primary mt-4">{title}</h3>
      {description && <p className="mt-2 max-w-md text-text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function DefaultIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden="true">
      {/* soft cloud */}
      <ellipse cx="60" cy="30" rx="38" ry="14" fill="#F4EAD3" opacity="0.9" />
      <ellipse cx="44" cy="28" rx="14" ry="10" fill="#F4EAD3" opacity="0.85" />
      <ellipse cx="76" cy="28" rx="14" ry="10" fill="#F4EAD3" opacity="0.85" />
      {/* falling raindrops */}
      <ellipse cx="42" cy="55" rx="2.5" ry="4.5" fill="#2D575E" opacity="0.7" />
      <ellipse cx="60" cy="62" rx="2.8" ry="5" fill="#2D575E" opacity="0.85" />
      <ellipse cx="78" cy="56" rx="2.5" ry="4.5" fill="#2D575E" opacity="0.7" />
      <ellipse cx="50" cy="78" rx="2.2" ry="4" fill="#2D575E" opacity="0.55" />
      <ellipse cx="70" cy="80" rx="2.2" ry="4" fill="#2D575E" opacity="0.55" />
      {/* small umbrella offered, bottom-right */}
      <g transform="translate(85,68)">
        <path d="M0 12 C0 5.5 5 2 11 2 C17 2 22 5.5 22 12 Z" fill="#A86F3D" />
        <path d="M11 12 L11 19 Q11 21.5 8.5 21.5" stroke="#A86F3D" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
