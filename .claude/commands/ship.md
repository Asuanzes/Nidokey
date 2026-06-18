---
description: "Despliegue Nidokey: tsc de lo que cambió → commit → push (deploy web en Vercel) → eas update Android si tocó el móvil. Uso: /ship <mensaje de commit>"
argument-hint: <mensaje de commit>
---

Ritual de despliegue de Nidokey. Mensaje de commit: **$ARGUMENTS**
Si `$ARGUMENTS` está vacío, pídelo y para (no inventes el mensaje).

Ejecuta EN ORDEN, parando ante el primer fallo. Monorepo con rutas de
despliegue distintas: web/backend → Vercel al pushear; móvil → EAS OTA.

## 1. Detectar qué cambió
`git status --porcelain` + `git diff --name-only HEAD`. Clasifica rutas:
- **Móvil** = `apps/mobile/**`
- **Web/backend** = `src/**`, `packages/**`, `prisma/**`
- **Esquema** = `prisma/schema.prisma`
- **Nativo** = `apps/mobile/package.json`, `apps/mobile/app.json`,
  `apps/mobile/app.config.*`, `apps/mobile/android/**`, `apps/mobile/ios/**`

Si no hay cambios, dilo y termina.

## 2. Esquema (si cambió `prisma/schema.prisma`)
⚠️ NUNCA `prisma migrate dev/deploy` (reset destructivo en Neon). El cambio de
esquema se aplica SOLO con `npx prisma db push`. Pregunta antes de ejecutarlo.

## 3. tsc — solo lo que cambió
- Web/backend tocado → `npx tsc --noEmit -p tsconfig.json`
- Móvil tocado → `cd "apps/mobile" && npx tsc --noEmit`
Si alguno falla: **para**, muestra los errores, NO commitees.

## 4. Resumen + confirmación (OBLIGATORIA)
Muestra el plan: qué desplegará (web sí/no, OTA móvil sí/no) y avisos.
- ⚠️ Si hubo cambio **nativo**: avisa "OTA (eas update) NO arrastra cambios
  nativos → necesitas EAS Build / `expo run:android`, no basta /ship".
**Espera el OK del usuario antes de seguir.** Sin OK explícito, no pushees.

## 5. Commit
`git add -A` y commit con `$ARGUMENTS` como mensaje, terminando con el trailer:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
(Se trabaja directo en `main`: es la rama que despliega.)

## 6. Push → deploy web
`git push origin main`. Esto dispara el deploy del backend en Vercel solo.

## 7. OTA móvil (solo si hubo cambios en `apps/mobile/**`)
`cd "apps/mobile" && eas update --branch preview --platform android -m "$ARGUMENTS"`
Si falla por sesión/auth de EAS: NO es fatal (el push ya está hecho). Avisa
"haz el OTA donde tengas sesión EAS" y sigue.

## 8. Cierre
Resume: hash del commit, deploy web disparado, OTA publicado o no, y pendientes
(cambios nativos sin rebuild, iOS sin publicar, db push pendiente).
