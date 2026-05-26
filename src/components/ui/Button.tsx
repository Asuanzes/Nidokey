import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-primary-fg hover:opacity-90",
  secondary: "bg-surface text-text border border-border hover:bg-surface-muted",
  ghost: "text-text hover:bg-surface-muted",
  danger: "bg-danger text-primary-fg hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  )
);
Button.displayName = "Button";
