import * as React from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-6 border-b border-border py-8 last:border-0 md:grid-cols-[260px_1fr]", className)}>
      <header>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
