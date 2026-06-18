#!/usr/bin/env node
// PreToolUse hook: bloquea `prisma migrate` (dev/deploy/reset/...) en Bash/PowerShell.
// Neon se gestiona con `prisma db push`; migrate hace RESET DESTRUCTIVO de la BBDD.
// Recibe el JSON de la tool por stdin; exit 2 = bloquea y devuelve stderr a Claude.
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = ((JSON.parse(input) || {}).tool_input || {}).command || "";
  } catch {
    process.exit(0); // si no se puede parsear, no bloquees
  }
  // `prisma migrate ...` (incluye `npx prisma migrate`); NO afecta a `prisma db push`.
  if (/\bprisma\s+migrate\b/i.test(cmd)) {
    process.stderr.write(
      "BLOQUEADO: `prisma migrate` esta prohibido en este proyecto.\n" +
        "Neon se gestiona con `prisma db push` (migrate dev/deploy/reset hace RESET DESTRUCTIVO).\n" +
        "Cambios de esquema: edita prisma/schema.prisma y luego `npx prisma db push`.\n",
    );
    process.exit(2);
  }
  process.exit(0);
});
