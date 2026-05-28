/* Nidokey - Helpers compartidos entre userscripts
 * NO se carga directamente; está aquí como referencia de las funciones que
 * cada userscript reimplementa (Tampermonkey no soporta @require local fácil
 * sin servir desde un dominio).
 *
 * Funciones que aparecen en cada userscript:
 *   - injectButton(): añade el botón flotante "📥 Importar a Nidokey".
 *   - notify(msg, color): muestra toast en la esquina superior derecha.
 *   - text(sel, root): textContent del primer match, trim.
 *   - intFrom(str): primer entero del string (ignora . y espacios).
 *   - readJsonLd(predicate): parsea todos los <script type="application/ld+json">
 *     y devuelve el primero que matchee.
 *   - extractFromMetaAndJsonLd(): { title, description, price, images } por defecto.
 *   - send(payload): envía con GM_xmlhttpRequest y muestra el toast adecuado.
 */
