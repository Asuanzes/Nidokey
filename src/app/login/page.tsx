import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { IconKey } from "@/components/brand/icons";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={22} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-text">BuySell</div>
            <div className="text-xs text-text-subtle">Asturias</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-text">Accede a tu cuenta</h1>
          <p className="text-sm text-text-muted">
            Te enviaremos un enlace por email para entrar sin contraseña.
          </p>
        </div>

        <Suspense fallback={<div className="h-10 animate-pulse rounded-md bg-surface-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
