"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, ChevronDown, ChevronRight, Download,
  LayoutDashboard, Moon, Plus, Search, Settings, Sparkles, Sun, User,
} from "lucide-react";
import { IconKey } from "@/components/brand/icons";
import { cn } from "@/lib/cn";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserMenu } from "@/components/UserMenu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  accent: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "catalogo",
    label: "Catálogo",
    accent: "#3A5F8A",
    items: [
      { href: "/matches", label: "Duplicados", icon: Sparkles },
    ],
  },
  {
    id: "analisis",
    label: "Análisis",
    accent: "#2C7A8A",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity",  label: "Actividad", icon: Activity },
    ],
  },
  {
    id: "captura",
    label: "Captura",
    accent: "#A86A17",
    items: [
      { href: "/bookmarklet", label: "Importar", icon: Download },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [dupCount, setDupCount] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    catalogo: true, analisis: true, captura: true,
  });
  const [dark, setDark] = useState(false);

  // Inicializa desde localStorage y sincroniza con el DOM
  useEffect(() => {
    const saved = localStorage.getItem("buysell.theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("buysell.theme", next ? "dark" : "light");
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEmail(d?.user?.email ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Cuenta de duplicados pendientes para la pill global del topbar y el badge del nav.
  useEffect(() => {
    if (!email) return; // espera a tener sesión confirmada
    let cancelled = false;
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDupCount(Array.isArray(d?.items) ? d.items.length : 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [email, pathname]);

  // Páginas sin shell (login).
  if (pathname === "/login" || pathname?.startsWith("/login/")) {
    return <>{children}</>;
  }

  const toggleGroup = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="flex min-h-screen">
      {/* ===== Sidebar ===== */}
      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        {/* Brand block → link a Mis casas */}
        <Link
          href="/properties"
          className="flex h-14 items-center gap-2 border-b border-border px-4 transition-colors hover:bg-surface-muted"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-text">BuySell</div>
            <div className="text-[11px] text-text-subtle">Asturias</div>
          </div>
        </Link>

        {/* Grouped nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navGroups.map((g) => {
            const open = openGroups[g.id];
            return (
              <div key={g.id} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className="flex w-full items-center justify-between gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-subtle hover:text-text-muted"
                  style={{ borderLeft: `2px solid ${g.accent}`, paddingLeft: 6 }}
                >
                  <span>{g.label}</span>
                  {open
                    ? <ChevronDown size={11} className="text-text-subtle" />
                    : <ChevronRight size={11} className="text-text-subtle" />}
                </button>
                {open && (
                  <div className="mt-0.5 space-y-0.5">
                    {g.items.map((it) => {
                      const active = it.href !== "#" && pathname?.startsWith(it.href);
                      const Icon = it.icon;
                      const isDuplicados = it.href === "/matches";
                      return (
                        <Link
                          key={it.href + it.label}
                          href={it.disabled ? "#" : it.href}
                          aria-disabled={it.disabled}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-primary-soft text-primary font-medium"
                              : "text-text-muted hover:bg-surface-muted hover:text-text",
                            it.disabled && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <Icon size={15} className={cn(active ? "text-primary" : "text-text-subtle")} />
                          <span className="flex-1">{it.label}</span>
                          {isDuplicados && dupCount > 0 && (
                            <span
                              className={cn(
                                "rounded px-1.5 text-[11px] font-medium tabular",
                                active
                                  ? "bg-primary-soft text-primary"
                                  : "bg-surface-muted text-text-muted"
                              )}
                            >
                              {dupCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer / Cuenta */}
        <div className="space-y-1 border-t border-border p-2">
          <Link
            href="#"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Settings size={15} className="text-text-subtle" />
            Ajustes
          </Link>
          {email && <UserMenu email={email} />}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
          >
            {dark ? <Sun size={15} className="text-text-subtle" /> : <Moon size={15} className="text-text-subtle" />}
            {dark ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <GlobalSearch />
          <div className="flex items-center gap-3">
            {/* Pill global de duplicados pendientes — visible solo cuando dupCount > 0
                y cuando no estás ya en /matches (evita ruido redundante). */}
            {dupCount > 0 && !pathname?.startsWith("/matches") && (
              <Link
                href="/matches"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular transition-colors hover:bg-warning-soft"
                style={{
                  background: "rgba(196, 154, 77, 0.12)",
                  color: "#A86A17",
                  borderColor: "rgba(196, 154, 77, 0.34)",
                }}
              >
                <Sparkles size={12} />
                {dupCount} duplicado{dupCount > 1 ? "s" : ""} pendiente{dupCount > 1 ? "s" : ""} →
              </Link>
            )}
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
