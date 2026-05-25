"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";

type Props = {
  email: string;
};

export function UserMenu({ email }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-[10px] font-medium">
          {email.slice(0, 2).toUpperCase()}
        </div>
        <span className="min-w-0 flex-1 truncate text-left text-xs">{email}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-md border border-border bg-surface shadow-md">
          <div className="border-b border-border bg-surface-muted px-3 py-2 text-[11px] text-text-subtle">
            <div className="flex items-center gap-1.5">
              <User size={11} />
              Sesión activa
            </div>
            <div className="mt-0.5 truncate text-text">{email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
