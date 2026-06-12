export default async function FakePayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const intentId = String(sp.intentId ?? "");
  const orderId = String(sp.orderId ?? "");
  const amount = Number(sp.amount ?? 0);
  const currency = String(sp.currency ?? "EUR");
  const token = String(sp.t ?? "");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FAFAF7", color: "#262320", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, border: "1px solid #E4DED2", borderRadius: 12, background: "#fff", padding: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Pago de prueba</h1>
        <p style={{ margin: "0 0 20px", color: "#71695F" }}>
          Pedido {orderId.slice(0, 8)} · {(amount / 100).toLocaleString("es-ES", { style: "currency", currency })}
        </p>
        <form method="post" action={`/api/payments/fake/${encodeURIComponent(intentId)}`} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="t" value={token} />
          <button name="result" value="ok" style={{ height: 48, border: 0, borderRadius: 10, background: "#3A5F8A", color: "#fff", fontWeight: 700 }}>
            Simular pago OK
          </button>
          <button name="result" value="ko" style={{ height: 48, border: "1px solid #D7CDBE", borderRadius: 10, background: "#fff", color: "#8A3A3A", fontWeight: 700 }}>
            Simular pago KO
          </button>
        </form>
      </section>
    </main>
  );
}
