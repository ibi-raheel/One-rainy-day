import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "text" | "info";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  text: "btn-text",
  info: "btn-info",
};

const SIZE: Record<Size, string> = {
  sm: "text-sm py-1.5 px-2.5",
  md: "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(VARIANT[variant], SIZE[size], className)}
      {...rest}
    />
  );
});
