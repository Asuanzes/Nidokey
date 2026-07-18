# Nidokey — onboarding para agentes

**Lee `CLAUDE.md` (raíz) antes de tocar nada**: es el brief único y actual del
proyecto (qué es Nidokey, monorepo, infra/deploy, convenciones, gotchas,
pendientes). Este fichero es solo un puntero para no mantener dos copias.

Reglas mínimas si aún no lo has leído:

- Se trabaja SOLO en `apps/mobile/` (la web es landing + API).
- Neon Postgres se gestiona con `prisma db push` — NUNCA `migrate dev/deploy`.
- Todo cambio JS de la app sale por `eas update` (OTA); nativo requiere rebuild.
- No commitear `.env`; el repo es público.

La spec histórica del producto original "BuySell Asturias" está en
`docs/blitzy-tech-spec.md` y NO describe la app actual.
