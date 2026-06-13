#!/usr/bin/env bash
# Despliegue idempotente de Crawl4AI en el VPS (junto al chat gateway).
# Renderiza webs de restaurantes -> markdown; la app (Vercel) lo pasa por Claude.
#
# Uso (en el VPS, con sudo, desde la carpeta crawl4ai/ del repo):
#   sudo bash deploy.sh
# Opcional: CERTBOT_EMAIL=tu@correo sudo -E bash deploy.sh
#
# Re-ejecutable sin miedo: reutiliza el secreto ya generado, no duplica nada y no
# toca el chat gateway (que corre por systemd, no por Docker).
set -euo pipefail

DEST=/opt/nidokey-crawl4ai
NGINX_CONF=/etc/nginx/conf.d/scrape.nidokey.es.conf
DOMAIN=scrape.nidokey.es
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/7  Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "    Docker no está instalado; instalando con get.docker.com (no afecta al gateway)…"
  curl -fsSL https://get.docker.com | sh
fi
docker --version
if ! docker compose version >/dev/null 2>&1; then
  echo "    ERROR: falta el plugin 'docker compose'. Instálalo (docker-compose-plugin) y reintenta." >&2
  exit 1
fi

echo "==> 2/7  Artefactos en $DEST"
mkdir -p "$DEST"
cp "$SRC_DIR/docker-compose.yml" "$DEST/docker-compose.yml"

echo "==> 3/7  Levantar Crawl4AI (descarga ~1-2 GB la 1ª vez)"
( cd "$DEST" && docker compose pull && docker compose up -d )

echo "==> 4/7  Esperar a que escuche en 127.0.0.1:11235"
ok=0
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:11235/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done
[ "$ok" = 1 ] && echo "    server arriba" || echo "    AVISO: /health no respondió aún (revisa: cd $DEST && docker compose logs)"

echo "==> 5/7  Secreto bearer (CRAWL4AI_SECRET)"
SECRET=""
[ -f "$NGINX_CONF" ] && SECRET=$(grep -oP 'Bearer \K[0-9a-f]{64}' "$NGINX_CONF" | head -1 || true)
if [ -z "$SECRET" ]; then
  SECRET=$(openssl rand -hex 32)
  echo "    generado secreto nuevo"
else
  echo "    reutilizando secreto existente del vhost"
fi

echo "==> 6/7  nginx vhost (con bearer) + recarga"
sed "s/REEMPLAZA_CON_CRAWL4AI_SECRET/$SECRET/" "$SRC_DIR/nginx-scrape.nidokey.es.conf" > "$NGINX_CONF"
nginx -t
systemctl reload nginx

echo "==> 7/7  TLS (certbot) — requiere que $DOMAIN ya resuelva a este VPS"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "    ya existe certificado para $DOMAIN"
elif command -v certbot >/dev/null 2>&1; then
  if [ -n "${CERTBOT_EMAIL:-}" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" \
      || echo "    certbot falló (¿DNS aún no propaga?). Reintenta luego: certbot --nginx -d $DOMAIN"
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email \
      || echo "    certbot falló (¿DNS aún no propaga?). Reintenta luego: certbot --nginx -d $DOMAIN"
  fi
else
  echo "    AVISO: certbot no está instalado. Instálalo (apt install certbot python3-certbot-nginx) y corre: certbot --nginx -d $DOMAIN"
fi

echo
echo "================== LISTO =================="
echo "Pon estas variables en Vercel (Production + Preview) y redeploy:"
echo "  CRAWL4AI_URL=https://$DOMAIN"
echo "  CRAWL4AI_SECRET=$SECRET"
echo "  ANTHROPIC_API_KEY=<tu clave de console.anthropic.com>"
echo "==========================================="
