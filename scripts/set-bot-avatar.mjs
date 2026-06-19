// Fija el avatar del usuario-bot @Nidokey al logo de la app.
// Sube el logo a R2 (mismo bucket que los avatares de usuario) y pone la key en
// User.image; serialize.avatarUrl() ya sirve /api/avatar/nidokey-bot a partir de ahí.
// Idempotente: PutObject sobreescribe y el update fija la key.
// Uso:  node --env-file=.env scripts/set-bot-avatar.mjs
import { readFile } from "node:fs/promises";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const BOT_ID = "nidokey-bot";
const KEY = `avatars/${BOT_ID}/logo.png`;
const LOGO = "apps/mobile/assets/images/icon.png";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Faltan env R2_* (corre con: node --env-file=.env scripts/set-bot-avatar.mjs)");
  process.exit(1);
}
const endpoint =
  process.env.R2_ENDPOINT?.trim().replace(/\/+$/, "") || `https://${accountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const body = await readFile(LOGO);
await s3.send(new PutObjectCommand({ Bucket: bucket, Key: KEY, Body: body, ContentType: "image/png" }));
console.log(`✓ Subido a R2: ${KEY} (${body.length} bytes)`);

const prisma = new PrismaClient();
try {
  const bot = await prisma.user.findUnique({ where: { id: BOT_ID }, select: { id: true, name: true } });
  if (!bot) {
    console.error(
      `⚠ El usuario ${BOT_ID} aún no existe (se crea al primer chat con @Nidokey).\n` +
        `  La imagen ya está en R2; vuelve a correr el script tras abrir un chat con el bot.`,
    );
    process.exit(2);
  }
  await prisma.user.update({ where: { id: BOT_ID }, data: { image: KEY } });
  console.log(`✓ User ${BOT_ID}.image = ${KEY}`);
  console.log(`  Avatar servible en: <NEXTAUTH_URL>/api/avatar/${BOT_ID}?v=logo.png`);
} finally {
  await prisma.$disconnect();
}
