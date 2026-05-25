import * as React from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <span className="text-xs font-medium text-text-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-xs text-text-subtle">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}
