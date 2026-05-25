"use server";

import { signIn } from "@/lib/auth";

/**
 * Server Action que dispara el envío del magic-link.
 *
 * Ventaja sobre fetch manual: NextAuth maneja CSRF internamente con las
 * cookies de la sesión, así que no necesitamos pelearnos con el token.
 *
 * NextAuth en v5 lanza una redirección dentro de signIn() — la capturamos
 * y la dejamos propagar para que Next la procese.
 */
export async function sendMagicLinkAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Email inválido" };
  }
  try {
    await signIn("email", {
      email,
      redirectTo: "/dashboard",
      redirect: false, // queremos quedarnos en /login con mensaje "revisa tu email"
    });
    return { ok: true };
  } catch (e) {
    // signIn lanza un objeto Redirect cuando redirect:true. Con redirect:false
    // los errores reales sí llegan aquí.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("NEXT_REDIRECT")) {
      // No debería llegar aquí con redirect:false, pero por seguridad
      throw e;
    }
    console.error("[auth] signIn error:", e);
    return { ok: false, error: "No se pudo enviar el email. Inténtalo de nuevo." };
  }
}
