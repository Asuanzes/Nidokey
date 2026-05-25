"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Building2, LayoutDashboard, LayoutGrid, Plus, Settings, Sparkles } from "lucide-react";
import { IconKey } from "@/components/brand/icons";
import { cn } from "@/lib/cn";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserMenu } from "@/components/UserMenu";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Inmuebles", icon: Building2 },
  { href: "/matches", label: "Duplicados", icon: Sparkles },
  { href: "/activity", label: "Actividad", icon: Activity },
  { href: "/searches", label: "Búsquedas", icon: LayoutGrid, disabled: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setEmail(d?.user?.email ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Páginas que se renderizan sin sidebar/topbar (login, etc.)
  if (pathname === "/login" || pathname?.startsWith("/login/")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-text">BuySell</div>
            <div className="text-[11px] text-text-subtle">Asturias</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {nav.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                aria-disabled={item.disabled}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary-soft text-primary font-medium"
                    : "text-text-muted hover:bg-surface-muted hover:text-text",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <Icon size={15} className={cn(active ? "text-primary" : "text-text-subtle")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-2">
          <Link
            href="#"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Settings size={15} className="text-text-subtle" />
            Ajustes
          </Link>
          {email && <UserMenu email={email} />}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <GlobalSearch />
          <div className="flex items-center gap-2">
            <Link
              href="/properties/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              <Plus size={14} />
              Nuevo inmueble
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
