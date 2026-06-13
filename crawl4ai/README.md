# Crawl4AI self-hosted (scraping de menús, GRATIS)

Servicio de scraping propio para la vertical **Comida**. Renderiza la web de un
restaurante con Playwright y devuelve **markdown limpio**; la app (en Vercel) lo
pasa por **Claude Haiku** para extraer la carta a JSON. Sustituye a Firecrawl (de
pago); Firecrawl queda solo como respaldo para sitios con DataDome.

Vive en el **mismo VPS** que el chat gateway (Hetzner). No toca la BBDD ni recibe
`AUTH_SECRET`. La única protección es nginx + un bearer compartido.

```
[Vercel] crawl4aiMarkdown(url)
   │  POST https://scrape.nidokey.es/crawl   (Authorization: Bearer CRAWL4AI_SECRET)
   ▼
[nginx :443] --(valida bearer, TLS)--> [Docker crawl4ai :11235 (loopback)]
   ▼
   markdown  ──►  [Vercel] Claude Haiku extrae JSON (MENU_SCHEMA)  ──►  Neon
```

## Requisitos en el VPS
- Docker + docker compose (ya instalados para otros servicios).
- nginx + certbot (ya en uso para `ws.nidokey.es`).
- DNS: añade `scrape.nidokey.es` → IP del VPS (gestionado en **Vercel**, igual que el resto de `nidokey.es`).

## Despliegue
```bash
# 1) Copiar artefactos al VPS
sudo mkdir -p /opt/nidokey-crawl4ai
sudo rsync -a ./crawl4ai/ /opt/nidokey-crawl4ai/

# 2) Generar el secreto compartido (guárdalo: va también en Vercel)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3) Arrancar Crawl4AI (descarga la imagen con Chromium; tarda la 1ª vez)
cd /opt/nidokey-crawl4ai
sudo docker compose up -d
sudo docker compose logs -f   # espera a que el server escuche en :11235

# 4) nginx: copiar el vhost, poner el secreto, recargar y sacar TLS
sudo cp /opt/nidokey-crawl4ai/nginx-scrape.nidokey.es.conf /etc/nginx/conf.d/scrape.nidokey.es.conf
sudo sed -i 's/REEMPLAZA_CON_CRAWL4AI_SECRET/<EL_SECRETO>/' /etc/nginx/conf.d/scrape.nidokey.es.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d scrape.nidokey.es
```

## Variables en Vercel (Production + Preview)
- `CRAWL4AI_URL` = `https://scrape.nidokey.es`
- `CRAWL4AI_SECRET` = el secreto del paso 2 (idéntico al de nginx)
- `ANTHROPIC_API_KEY` = clave de console.anthropic.com (la extracción corre en Vercel, no en el VPS)
- (opcional) `ANTHROPIC_MODEL` para sobreescribir el modelo de extracción

## Smoke test
```bash
# Desde el VPS (loopback, sin nginx):
curl -s http://127.0.0.1:11235/health

# Desde fuera (a través de nginx + bearer):
curl -s https://scrape.nidokey.es/crawl \
  -H "Authorization: Bearer <EL_SECRETO>" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"],"crawler_config":{"type":"CrawlerRunConfig","params":{"cache_mode":"bypass"}}}' \
  | head -c 400
# → JSON con "markdown": "# Example Domain ..."
```

## Operación
- Logs: `sudo docker compose logs -f` (en `/opt/nidokey-crawl4ai`).
- Actualizar: `sudo docker compose pull && sudo docker compose up -d`.
- Memoria: Chromium ~300–500 MB por render; `shm_size: 1g` evita cuelgues.
- Seguridad: el puerto 11235 está atado a `127.0.0.1`; **nunca** lo abras en el firewall.
  Rotar el secreto = cambiarlo en nginx (paso 4) y en Vercel a la vez.
