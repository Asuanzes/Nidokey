"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2 } from "lucide-react";
import { sendMagicLinkAction } from "./actions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const checkEmail = searchParams.get("check") === "email";
  const errorParam = searchParams.get("error");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || pending) return;
    setError(null);
    const fd = new FormData();
    fd.append("email", email);
    startTransition(async () => {
      const result = await sendMagicLinkAction(fd);
      if (!result.ok) {
        setError(result.error ?? "Error desconocido");
        return;
      }
      setSent(true);
    });
  }

  if (sent || checkEmail) {
    return (
      <div className="space-y-3 rounded-md border border-success/30 bg-success-soft p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 size={16} />
          Email enviado
        </div>
        <p className="text-text-muted">
          Revisa tu bandeja. Pulsa el enlace que te hemos mandado para entrar.
        </p>
        <p className="text-xs text-text-subtle">
          Si no llega, mira en spam o vuelve a intentarlo en unos minutos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-text-muted">
          Email
        </label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoFocus
            autoComplete="email"
            className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm placeholder:text-text-subtle hover:border-border-strong focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      {(error || errorParam) && (
        <div className="text-xs text-danger">
          {error ?? "Hubo un problema al enviar el enlace. Inténtalo de nuevo."}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !email}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
