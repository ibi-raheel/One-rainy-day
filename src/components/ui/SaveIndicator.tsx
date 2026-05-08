import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Subtle "Saved" indicator that fades after `key` changes. */
export function SaveIndicator({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <span
      className={cn(
        "text-xs text-text-muted transition-opacity duration-300 ease-out-soft",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      Saved
    </span>
  );
}
