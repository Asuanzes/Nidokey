export default async function FoodPayReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const orderId = String(sp.orderId ?? "");
  const deepLink = `nidokey://food/order/${encodeURIComponent(orderId)}?from=payment`;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FAFAF7", color: "#262320", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href=${JSON.stringify(deepLink)};` }} />
      <section style={{ textAlign: "center" }}>
        <h1>Volviendo a Nidokey</h1>
        <p>Si la app no se abre automáticamente, vuelve a ella para verificar el pago.</p>
        <a href={deepLink}>Abrir pedido</a>
      </section>
    </main>
  );
}
