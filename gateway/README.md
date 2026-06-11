# Nidokey — Gateway de tiempo real del chat (VPS)

Proceso Node **sin base de datos** que da tiempo real al chat. Vive en tu VPS
detrás de Caddy (TLS). No guarda nada en reposo: solo retransmite avisos
(`{type:"message", conversationId}`) y "escribiendo…". El contenido de los
mensajes nunca pasa por aquí — el móvil lo pide a Vercel+Neon al recibir el aviso.

## Arquitectura (resumen)

```
Móvil  ──WSS──►  Caddy (ws.nidokey.es) ──► gateway :8787   (recibe avisos + typing)
Vercel ──HTTPS POST /notify (HMAC)──────► gateway :8787   (tras crear un mensaje)
```

- **Auth WS:** el móvil pide a Vercel un *ticket* corto (JWT 60 s) firmado con
  `CHAT_WS_SECRET` y se conecta a `wss://ws.nidokey.es/ws?ticket=…`.
- **Webhook:** Vercel firma el body con HMAC-SHA256 (`CHAT_GATEWAY_SECRET`) en el
  header `x-nidokey-signature: sha256=<hex>`.
- El VPS **no** recibe `AUTH_SECRET` ni `DATABASE_URL`.

## Requisitos

- Ubuntu (o similar) con Node ≥ 20.
- Un dominio apuntando al VPS (aquí `ws.nidokey.es`).
- Caddy v2 instalado (TLS automático).

## Despliegue paso a paso

1. **DNS:** crea un registro `A` `ws.nidokey.es` → IP pública del VPS.

2. **Código:** copia esta carpeta `gateway/` al VPS, p.ej. a `/opt/nidokey-gateway`:
   ```bash
   sudo mkdir -p /opt/nidokey-gateway
   # con rsync/scp desde tu equipo, o git sparse-checkout de la carpeta gateway/
   sudo rsync -a ./gateway/ /opt/nidokey-gateway/
   cd /opt/nidokey-gateway
   sudo npm install --omit=dev
   ```

3. **Secretos:** crea `/etc/nidokey-gateway.env` (mismos valores que pondrás en
   Vercel):
   ```bash
   PORT=8787
   CHAT_WS_SECRET=<valor>
   CHAT_GATEWAY_SECRET=<valor>
   ```
   Genera cada secreto con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Protégelo: `sudo chmod 600 /etc/nidokey-gateway.env`.

4. **Usuario de servicio + systemd:**
   ```bash
   sudo useradd --system --no-create-home nidokey || true
   sudo chown -R nidokey:nidokey /opt/nidokey-gateway
   sudo cp nidokey-gateway.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now nidokey-gateway
   sudo systemctl status nidokey-gateway
   ```

5. **Caddy:** añade el bloque de `Caddyfile` a `/etc/caddy/Caddyfile` y recarga:
   ```bash
   sudo systemctl reload caddy
   ```

6. **Firewall (UFW):** solo SSH + web:
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
   (El puerto 8787 NO se abre: solo lo alcanza Caddy en localhost.)

7. **Verifica:**
   ```bash
   curl https://ws.nidokey.es/healthz   # → {"ok":true}
   ```

8. **Vercel:** pon estas env (Production) y haz **Redeploy**:
   - `CHAT_GATEWAY_URL=https://ws.nidokey.es`
   - `CHAT_GATEWAY_SECRET=<mismo que el VPS>`
   - `CHAT_WS_SECRET=<mismo que el VPS>`

## Operación

- Logs: `sudo journalctl -u nidokey-gateway -f`
- Reiniciar: `sudo systemctl restart nidokey-gateway`
- Actualizar: copiar nuevos archivos → `npm install --omit=dev` → `systemctl restart`.

## Notas de seguridad

- Sin BBDD ni secretos de la app: si el VPS cae, el chat sigue funcionando por
  *polling* (degradación elegante).
- Tickets de 60 s: una fuga de ticket caduca casi al instante.
- HMAC en el webhook: nadie sin `CHAT_GATEWAY_SECRET` puede inyectar avisos.
