/* global React, T, IconKey, IconPlus, IconSearch, IconPin, IconBed, IconBath, IconArea, IconUp, IconDown, IconMinus, IconBack, IconEdit, IconExt, IconCalendar, IconRefresh, IconAlert, IconImage, IconFireplace, IconGarage, IconTerrace, IconSparkles, IconActivity, Button, Badge, StatusBadge, PriceDelta, Card, CardHeader, CardBody, Stat, PageHeader, AppShell, PropertyCard, PropertyTable, PropertyImage, FiltersSidebar, PriceHistoryChart, formatPrice, TYPE_LABEL */
/* eslint-disable react/prop-types */

// ============================================================
// Mock data — small but representative
// ============================================================

const PROPERTIES = [
  {
    id: "p1", title: "Piso reformado con terraza", type: "PISO", status: "FOR_SALE",
    city: "Oviedo", neighborhood: "Centro", province: "Asturias",
    address: "Calle Uría, 14, 3ºB", postalCode: "33003",
    currentPrice: 385000, rooms: 3, bathrooms: 2, builtArea: 92, usableArea: 84, plotArea: null,
    floor: "3ºB", yearBuilt: 1962, energyRating: "D",
    hasElevator: true, hasGarage: false, hasStorage: true, hasTerrace: true,
    hasFireplace: false, hasGarden: false, hasPool: false,
    description: "Piso completamente reformado en pleno centro de Oviedo. Tres habitaciones, dos baños, cocina office y una amplia terraza orientada al sur. A dos minutos andando de la estación de tren.",
    photo: null,
    priceHistory: [
      { observedAt: "2025-10-01", price: 410000 },
      { observedAt: "2025-11-15", price: 405000 },
      { observedAt: "2025-12-20", price: 395000 },
      { observedAt: "2026-01-10", price: 390000 },
      { observedAt: "2026-01-22", price: 385000 },
    ],
    listings: [
      { portal: "IDEALISTA", url: "#", lastPrice: 385000, status: "PRICE_DROP", lastCheckedAt: "Hoy" },
      { portal: "FOTOCASA",  url: "#", lastPrice: 385000, status: "ACTIVE",     lastCheckedAt: "Hace 2 días" },
      { portal: "PISOS_COM", url: "#", lastPrice: 390000, status: "ACTIVE",     lastCheckedAt: "Hace 4 días" },
    ],
  },
  {
    id: "p2", title: "Chalet con jardín en Llanes", type: "CHALET", status: "RESERVED",
    city: "Llanes", neighborhood: "Poo", province: "Asturias",
    address: "Camino del Puerto, 7", postalCode: "33509",
    currentPrice: 620000, rooms: 4, bathrooms: 3, builtArea: 180, usableArea: 165, plotArea: 480,
    floor: "—", yearBuilt: 2008, energyRating: "C",
    hasElevator: false, hasGarage: true, hasStorage: true, hasTerrace: true,
    hasFireplace: true, hasGarden: true, hasPool: false,
    description: "Chalet independiente a 800 m de la playa de Poo. Jardín privado de 480 m², garaje doble, chimenea de leña.",
    photo: null,
    priceHistory: [
      { observedAt: "2025-09-12", price: 650000 },
      { observedAt: "2025-11-04", price: 635000 },
      { observedAt: "2026-01-08", price: 620000 },
    ],
    listings: [{ portal: "IDEALISTA", url: "#", lastPrice: 620000, status: "ACTIVE", lastCheckedAt: "Hace 1 día" }],
  },
  {
    id: "p3", title: "Ático con vistas a la playa", type: "ATICO", status: "SOLD",
    city: "Gijón", neighborhood: "El Llano", province: "Asturias",
    address: "Av. del Llano, 142, 8ºA", postalCode: "33209",
    currentPrice: 295000, rooms: 2, bathrooms: 1, builtArea: 68, usableArea: 62, plotArea: null,
    floor: "8ºA", yearBuilt: 1975, energyRating: "E",
    hasElevator: true, hasGarage: false, hasStorage: false, hasTerrace: true,
    hasFireplace: false, hasGarden: false, hasPool: false,
    description: "Ático con terraza panorámica orientada al norte. Vistas despejadas al Cantábrico.",
    photo: null,
    priceHistory: [
      { observedAt: "2025-08-20", price: 320000 },
      { observedAt: "2025-10-12", price: 310000 },
      { observedAt: "2025-12-01", price: 295000 },
      { observedAt: "2026-01-15", price: 295000 },
    ],
    listings: [{ portal: "FOTOCASA", url: "#", lastPrice: 295000, status: "REMOVED", lastCheckedAt: "Hace 8 días" }],
  },
  {
    id: "p4", title: "Casa de pueblo con hórreo", type: "HOUSE", status: "FOR_SALE",
    city: "Cangas de Onís", neighborhood: null, province: "Asturias",
    address: "Lugar Margolles, s/n", postalCode: "33556",
    currentPrice: 178000, rooms: 4, bathrooms: 2, builtArea: 145, usableArea: 132, plotArea: 320,
    floor: "—", yearBuilt: 1934, energyRating: "G",
    hasElevator: false, hasGarage: false, hasStorage: true, hasTerrace: false,
    hasFireplace: true, hasGarden: true, hasPool: false,
    description: "Casa tradicional con hórreo de cuatro pegollos en el jardín. Necesita reforma.",
    photo: null,
    priceHistory: [{ observedAt: "2025-11-20", price: 185000 }, { observedAt: "2026-01-05", price: 178000 }],
    listings: [{ portal: "MILANUNCIOS", url: "#", lastPrice: 178000, status: "ACTIVE", lastCheckedAt: "Hace 12 días" }],
  },
  {
    id: "p5", title: "Estudio en zona universitaria", type: "ESTUDIO", status: "FOR_SALE",
    city: "Oviedo", neighborhood: "La Tenderina", province: "Asturias",
    address: "Calle La Lila, 38, 1º", postalCode: "33006",
    currentPrice: 89000, rooms: 1, bathrooms: 1, builtArea: 32, usableArea: 28, plotArea: null,
    floor: "1º", yearBuilt: 1985, energyRating: "E",
    hasElevator: false, hasGarage: false, hasStorage: false, hasTerrace: false,
    hasFireplace: false, hasGarden: false, hasPool: false,
    description: "Estudio compacto, ideal para inversión.",
    photo: null,
    priceHistory: [{ observedAt: "2025-12-15", price: 92000 }, { observedAt: "2026-01-18", price: 89000 }],
    listings: [{ portal: "HABITACLIA", url: "#", lastPrice: 89000, status: "PRICE_DROP", lastCheckedAt: "Hoy" }],
  },
  {
    id: "p6", title: "Dúplex en Avilés con plaza de garaje", type: "DUPLEX", status: "FOR_SALE",
    city: "Avilés", neighborhood: "La Magdalena", province: "Asturias",
    address: "Calle Doctor Graíño, 6, ático", postalCode: "33402",
    currentPrice: 215000, rooms: 3, bathrooms: 2, builtArea: 105, usableArea: 96, plotArea: null,
    floor: "Ático", yearBuilt: 1998, energyRating: "D",
    hasElevator: true, hasGarage: true, hasStorage: true, hasTerrace: true,
    hasFireplace: false, hasGarden: false, hasPool: false,
    description: "Dúplex luminoso con dos terrazas y plaza de garaje incluida.",
    photo: null,
    priceHistory: [{ observedAt: "2025-11-01", price: 220000 }, { observedAt: "2026-01-12", price: 215000 }],
    listings: [{ portal: "PISOS_COM", url: "#", lastPrice: 215000, status: "ACTIVE", lastCheckedAt: "Hace 3 días" }],
  },
];

const PORTAL_LABEL = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

// ============================================================
// Dashboard screen
// ============================================================

function DashboardScreen({ onOpenProperty }) {
  const totalActive    = PROPERTIES.filter(p => p.status === "FOR_SALE").length;
  const totalSold      = PROPERTIES.filter(p => p.status === "SOLD").length;
  const totalReserved  = PROPERTIES.filter(p => p.status === "RESERVED").length;
  const totalListings  = PROPERTIES.reduce((s, p) => s + p.listings.length, 0);

  const portalCounts = {};
  PROPERTIES.forEach(p => p.listings.forEach(l => {
    portalCounts[l.portal] = (portalCounts[l.portal] ?? 0) + 1;
  }));
  const portals = Object.entries(portalCounts).sort((a,b) => b[1] - a[1]);

  const cityPpsqm = [
    { city: "Oviedo",   avg: 2820, count: 8 },
    { city: "Gijón",    avg: 2640, count: 6 },
    { city: "Avilés",   avg: 1980, count: 4 },
    { city: "Llanes",   avg: 3240, count: 3 },
    { city: "Cangas",   avg: 1240, count: 2 },
  ];

  const attentionItems = [
    { Icon: IconRefresh,  label: "Listings sin re-check >7 días (auto)",     count: 4, hint: "Ejecuta npm run check-listings" },
    { Icon: IconRefresh,  label: "Listings sin re-check >7 días (manual)",  count: 2, hint: "Idealista / Milanuncios — usa el userscript" },
    { Icon: IconSparkles, label: "Duplicados pendientes de revisar",         count: 3, hint: null },
    { Icon: IconImage,    label: "Fotos sin foto-hash",                       count: 7, hint: "Ejecuta npm run hash-photos" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visión general de inmuebles, portales y matching"
      />

      <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16}}>
        <Stat label="En venta" value={totalActive}/>
        <Stat label="Vendidos" value={totalSold}/>
        <Stat label="Retirados" value={totalReserved}/>
        <Stat label="Listings" value={totalListings} hint={`en ${portals.length} portales`}/>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginTop: 16}}>
        <Card>
          <CardHeader title="Por portal"/>
          <CardBody>
            <div style={{display: "flex", flexDirection: "column", gap: 10}}>
              {portals.map(([portal, count]) => {
                const pct = (count / totalListings) * 100;
                return (
                  <div key={portal}>
                    <div style={{display: "flex", justifyContent: "space-between",
                                 alignItems: "baseline", fontSize: 12, marginBottom: 4}}>
                      <span style={{color: T.text}}>{PORTAL_LABEL[portal] ?? portal}</span>
                      <span style={{color: T.textMuted, fontVariantNumeric: "tabular-nums"}}>{count}</span>
                    </div>
                    <div style={{height: 6, background: T.surfaceMuted, borderRadius: 999, overflow: "hidden"}}>
                      <div style={{height: "100%", background: T.primary, width: `${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="€/m² medio por ciudad">
            <span style={{fontSize: 12, color: T.textMuted}}>Top 5 con ≥ 2 fichas</span>
          </CardHeader>
          <CardBody>
            <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8}}>
              {cityPpsqm.map(r => (
                <div key={r.city} style={{
                  background: T.surfaceMuted, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: 10,
                }}>
                  <div style={{fontSize: 12, color: T.textMuted,
                               overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"}}>
                    {r.city}
                  </div>
                  <div style={{fontSize: 16, fontWeight: 600, color: T.text, marginTop: 2,
                               fontVariantNumeric: "tabular-nums"}}>
                    {r.avg.toLocaleString("es-ES")} €/m²
                  </div>
                  <div style={{fontSize: 10, color: T.textSubtle, marginTop: 1,
                               fontVariantNumeric: "tabular-nums"}}>{r.count} fichas</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16}}>
        <Card>
          <CardHeader title={
            <span style={{display: "inline-flex", alignItems: "center", gap: 6}}>
              <IconAlert size={14} color={T.warning}/> Necesita atención
            </span>
          }/>
          <CardBody style={{padding: 16}}>
            <ul style={{margin: 0, padding: 0, listStyle: "none",
                        display: "flex", flexDirection: "column", gap: 8}}>
              {attentionItems.map((it, i) => (
                <li key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  background: T.surface, padding: "8px 10px",
                }}>
                  <div style={{display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0}}>
                    <span style={{color: T.textSubtle, marginTop: 1}}>
                      <it.Icon size={13}/>
                    </span>
                    <div style={{minWidth: 0}}>
                      <div style={{fontSize: 13, color: T.text,
                                   overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"}}>
                        {it.label}
                      </div>
                      {it.hint && (
                        <div style={{fontSize: 11, color: T.textSubtle,
                                     overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"}}>
                          {it.hint}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge tone={it.count > 0 ? "warning" : "neutral"}>{it.count}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Actividad reciente (30 d)"/>
          <CardBody>
            <div style={{fontSize: 32, fontWeight: 600, color: T.text,
                         fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em"}}>
              42
            </div>
            <div style={{fontSize: 12, color: T.textMuted, marginTop: 4}}>
              snapshots de precio registrados en los últimos 30 días
            </div>
            <div style={{marginTop: 12}}>
              <a href="#" style={{fontSize: 12, color: T.primary, textDecoration: "none"}}
                onClick={(e) => e.preventDefault()}>
                Ver actividad detallada →
              </a>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ============================================================
// Properties list screen — table or grid view
// ============================================================

function PropertiesScreen({ onOpenProperty }) {
  const [view, setView]       = React.useState("table");
  const [sort, setSort]       = React.useState("updatedAt-desc");
  const [filters, setFilters] = React.useState({});

  const onChange = (k, v) => setFilters(f => ({ ...f, [k]: v === "" || v === false ? undefined : v }));
  const onClear  = () => setFilters({});

  const filtered = React.useMemo(() => {
    return PROPERTIES.filter(p => {
      if (filters.city    && !p.city.toLowerCase().includes(String(filters.city).toLowerCase())) return false;
      if (filters.type    && p.type   !== filters.type)   return false;
      if (filters.status  && p.status !== filters.status) return false;
      if (filters.minPrice && p.currentPrice < +filters.minPrice) return false;
      if (filters.maxPrice && p.currentPrice > +filters.maxPrice) return false;
      if (filters.minRooms && (p.rooms ?? 0) < +filters.minRooms) return false;
      if (filters.hasFireplace && !p.hasFireplace) return false;
      if (filters.hasGarage    && !p.hasGarage)    return false;
      if (filters.hasTerrace   && !p.hasTerrace)   return false;
      return true;
    });
  }, [filters]);

  return (
    <>
      <PageHeader
        title="Inmuebles"
        description={`${filtered.length} ${filtered.length === 1 ? "ficha" : "fichas"} registradas`}
      />

      <div style={{display: "grid", gridTemplateColumns: "1fr 280px", gap: 24}}>
        <div style={{minWidth: 0, display: "flex", flexDirection: "column", gap: 16}}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 8, boxShadow: "0 1px 2px rgba(20,20,18,0.04)",
            padding: "8px 12px",
          }}>
            <div style={{display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textMuted}}>
              <span>Ordenar por</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                style={{
                  height: 28, padding: "0 24px 0 8px",
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  background: T.surface, color: T.text, fontSize: 12,
                  fontFamily: "inherit", outline: "none", appearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6862' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 6px center",
                }}>
                <option value="updatedAt-desc">Más recientes</option>
                <option value="currentPrice-asc">Precio: menor</option>
                <option value="currentPrice-desc">Precio: mayor</option>
                <option value="createdAt-desc">Creación</option>
              </select>
            </div>
            <div style={{
              display: "flex", borderRadius: 6, overflow: "hidden",
              border: `1px solid ${T.border}`,
            }}>
              {[["table", "Tabla"], ["grid", "Cuadrícula"]].map(([v, l]) => (
                <button key={v} onClick={() => setView(v)}
                  style={{
                    padding: "5px 12px", fontSize: 12,
                    background: view === v ? T.surfaceMuted : T.surface,
                    color: view === v ? T.text : T.textMuted,
                    border: 0, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: view === v ? 500 : 400,
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {view === "table"
            ? <PropertyTable rows={filtered} onRowClick={(r) => onOpenProperty(r.id)}/>
            : (
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16}}>
                {filtered.map(p => (
                  <PropertyCard key={p.id} p={p} onClick={() => onOpenProperty(p.id)}/>
                ))}
              </div>
            )}
        </div>

        <FiltersSidebar filters={filters} onChange={onChange}
          onClear={onClear} onApply={() => { /* state already applied */ }}/>
      </div>
    </>
  );
}

// ============================================================
// Property detail screen
// ============================================================

const FEATURE_DEFS = [
  { key: "hasElevator",  label: "Ascensor",  Icon: IconArea },
  { key: "hasGarage",    label: "Garaje",    Icon: IconGarage },
  { key: "hasStorage",   label: "Trastero",  Icon: IconArea },
  { key: "hasTerrace",   label: "Terraza",   Icon: IconTerrace },
  { key: "hasFireplace", label: "Chimenea",  Icon: IconFireplace },
  { key: "hasGarden",    label: "Jardín",    Icon: IconTerrace },
  { key: "hasPool",      label: "Piscina",   Icon: IconArea },
];

function PropertyDetailScreen({ propertyId, onBack }) {
  const p = PROPERTIES.find(x => x.id === propertyId) ?? PROPERTIES[0];
  const prev = p.priceHistory.length >= 2 ? p.priceHistory.at(-2).price : null;
  const first = p.priceHistory[0]?.price ?? null;

  return (
    <>
      <PageHeader
        title={p.title}
        description={[TYPE_LABEL[p.type], p.neighborhood, p.city, p.province].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack}><IconBack size={13}/> Volver</Button>
            <Button variant="secondary" size="sm"><IconEdit size={13}/> Editar</Button>
          </>
        }
      />

      <div style={{display: "grid", gridTemplateColumns: "1fr 320px", gap: 24}}>
        {/* Left column */}
        <div style={{minWidth: 0, display: "flex", flexDirection: "column", gap: 24}}>
          {/* Gallery */}
          <div style={{
            position: "relative", aspectRatio: "16/10", borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.surfaceMuted, overflow: "hidden",
          }}>
            <PropertyImage photo={p.photo}/>
          </div>

          {p.description && (
            <Card>
              <CardHeader title="Descripción"/>
              <CardBody>
                <p style={{margin: 0, fontSize: 13, lineHeight: 1.5,
                           color: T.text, whiteSpace: "pre-wrap"}}>{p.description}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Histórico de precio">
              <PriceDelta from={first} to={p.currentPrice} showAbsolute/>
            </CardHeader>
            <CardBody>
              <PriceHistoryChart data={p.priceHistory}/>
            </CardBody>
          </Card>
        </div>

        {/* Right aside */}
        <aside style={{display: "flex", flexDirection: "column", gap: 16}}>
          <Card>
            <CardBody>
              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                <StatusBadge status={p.status}/>
                {p.priceHistory.length >= 2 && <PriceDelta from={prev} to={p.currentPrice}/>}
              </div>
              <div style={{marginTop: 12, fontSize: 32, fontWeight: 600,
                           color: T.text, fontVariantNumeric: "tabular-nums",
                           letterSpacing: "-0.02em", lineHeight: 1.1}}>
                {formatPrice(p.currentPrice)}
              </div>
              {p.builtArea && (
                <div style={{marginTop: 4, fontSize: 12, color: T.textMuted}}>
                  {Math.round(p.currentPrice / p.builtArea).toLocaleString("es-ES")} €/m²
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Características"/>
            <CardBody>
              <dl style={{display: "grid", gridTemplateColumns: "1fr 1fr",
                          columnGap: 16, rowGap: 8, fontSize: 13, margin: 0}}>
                <Spec label="Tipo" value={TYPE_LABEL[p.type]}/>
                <Spec label="Habitaciones" value={p.rooms ?? "—"}/>
                <Spec label="Baños" value={p.bathrooms ?? "—"}/>
                <Spec label="Construidos" value={p.builtArea ? `${p.builtArea} m²` : "—"}/>
                <Spec label="Útiles" value={p.usableArea ? `${p.usableArea} m²` : "—"}/>
                <Spec label="Parcela" value={p.plotArea ? `${p.plotArea} m²` : "—"}/>
                <Spec label="Planta" value={p.floor ?? "—"}/>
                <Spec label="Año" value={p.yearBuilt ?? "—"}/>
              </dl>
              <div style={{marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`}}>
                <div style={{fontSize: 12, fontWeight: 500, color: T.textMuted, marginBottom: 8}}>
                  Extras
                </div>
                <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
                  {FEATURE_DEFS.filter(f => p[f.key]).map(f => (
                    <Badge key={f.key} tone="primary">{f.label}</Badge>
                  ))}
                  {FEATURE_DEFS.every(f => !p[f.key]) && (
                    <span style={{fontSize: 12, color: T.textSubtle}}>Sin extras marcados</span>
                  )}
                </div>
              </div>
              {p.energyRating && p.energyRating !== "UNKNOWN" && (
                <div style={{marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`,
                             fontSize: 12, color: T.textMuted}}>
                  Certificación energética: <span style={{fontWeight: 500, color: T.text}}>{p.energyRating}</span>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ubicación"/>
            <CardBody style={{display: "flex", flexDirection: "column", gap: 6, fontSize: 13}}>
              {p.address && (
                <div style={{display: "flex", alignItems: "flex-start", gap: 8, color: T.text}}>
                  <IconPin size={13} color={T.textSubtle} style={{marginTop: 2}}/>
                  <span>{p.address}</span>
                </div>
              )}
              <div style={{color: T.textMuted}}>
                {p.neighborhood ? `${p.neighborhood}, ` : ""}
                {p.postalCode ? `${p.postalCode} ` : ""}{p.city}
              </div>
              <div style={{color: T.textMuted}}>{p.province}, España</div>
            </CardBody>
          </Card>

          {p.listings.length > 0 && (
            <Card>
              <CardHeader title="Anuncios vinculados"/>
              <CardBody>
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                  {p.listings.map((l, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", gap: 8,
                      paddingBottom: i === p.listings.length - 1 ? 0 : 12,
                      borderBottom: i === p.listings.length - 1 ? 0 : `1px solid ${T.border}`,
                    }}>
                      <div style={{minWidth: 0}}>
                        <a href={l.url} onClick={e => e.preventDefault()}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 13, fontWeight: 500, color: T.primary, textDecoration: "none",
                          }}>
                          {PORTAL_LABEL[l.portal] ?? l.portal} <IconExt size={11}/>
                        </a>
                        <div style={{marginTop: 2, fontSize: 12, color: T.textMuted,
                                     fontVariantNumeric: "tabular-nums"}}>
                          {formatPrice(l.lastPrice)} · revisado {l.lastCheckedAt}
                        </div>
                      </div>
                      <StatusBadge status={l.status}/>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function Spec({ label, value }) {
  return (
    <>
      <dt style={{color: T.textMuted, fontSize: 13}}>{label}</dt>
      <dd style={{margin: 0, textAlign: "right", fontWeight: 500, color: T.text,
                  fontVariantNumeric: "tabular-nums", fontSize: 13}}>{value}</dd>
    </>
  );
}

// ============================================================
// Matches / activity — minimal placeholder screens
// ============================================================

function ActivityScreen() {
  const events = [
    { day: "Hoy", items: [
      { dir: "down", title: "Piso reformado con terraza", city: "Oviedo", prev: 390000, cur: 385000, portal: "IDEALISTA", when: "Hoy" },
      { dir: "down", title: "Estudio en zona universitaria", city: "Oviedo", prev: 92000, cur: 89000, portal: "HABITACLIA", when: "Hoy" },
    ]},
    { day: "22 enero 2026", items: [
      { dir: "sold", title: "Ático con vistas a la playa", city: "Gijón", prev: 295000, cur: 295000, portal: "FOTOCASA", when: "Ayer" },
    ]},
    { day: "15 enero 2026", items: [
      { dir: "up",   title: "Casa de pueblo con hórreo", city: "Cangas de Onís", prev: 175000, cur: 178000, portal: "MILANUNCIOS", when: "Hace 8 días" },
      { dir: "flat", title: "Dúplex en Avilés con plaza de garaje", city: "Avilés", prev: 215000, cur: 215000, portal: "PISOS_COM", when: "Hace 8 días" },
    ]},
  ];
  const cfg = {
    up:   { wrap: { background: T.priceUpBg,   color: T.priceUpFg }, Icon: IconUp,   label: "Subida de precio" },
    down: { wrap: { background: T.priceDownBg, color: T.priceDownFg }, Icon: IconDown, label: "Bajada de precio" },
    flat: { wrap: { background: T.surfaceMuted, color: T.textMuted }, Icon: IconMinus, label: "Sin cambio" },
    sold: { wrap: { background: T.successSoft, color: T.success }, Icon: IconActivity, label: "Marcado como vendido" },
  };
  return (
    <>
      <PageHeader title="Actividad" description="Cambios de precio, transiciones de estado y eventos de scraping."/>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16}}>
        <Stat label="Bajadas (30d)" value="5" hint="Inmuebles con precio reducido"/>
        <Stat label="Subidas (30d)" value="1" hint="Inmuebles con precio aumentado"/>
        <Stat label="Vendidos (30d)" value="1" hint="Anuncios marcados vendidos"/>
      </div>
      <div style={{marginTop: 24, display: "flex", flexDirection: "column", gap: 32}}>
        {events.map(section => (
          <section key={section.day}>
            <h2 style={{margin: "0 0 12px", fontSize: 11, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        color: T.textSubtle}}>{section.day}</h2>
            <Card>
              <ul style={{margin: 0, padding: 0, listStyle: "none"}}>
                {section.items.map((ev, i) => {
                  const c = cfg[ev.dir];
                  return (
                    <li key={i} style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "14px 20px",
                      borderBottom: i === section.items.length - 1 ? 0 : `1px solid ${T.border}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        ...c.wrap,
                      }}>
                        <c.Icon size={13}/>
                      </div>
                      <div style={{flex: 1, minWidth: 0}}>
                        <div style={{fontSize: 13}}>
                          <span style={{fontWeight: 500, color: T.text}}>{ev.title}</span>
                          <span style={{color: T.textSubtle, marginLeft: 8}}>· {ev.city}</span>
                        </div>
                        <div style={{marginTop: 2, fontSize: 12, color: T.textMuted}}>
                          {c.label}
                          {ev.prev != null && ev.dir !== "flat" && (
                            <>
                              {" — "}
                              <span style={{fontVariantNumeric: "tabular-nums"}}>{formatPrice(ev.prev)}</span>
                              {" → "}
                              <span style={{fontWeight: 500, color: T.text,
                                            fontVariantNumeric: "tabular-nums"}}>{formatPrice(ev.cur)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge>{PORTAL_LABEL[ev.portal]}</Badge>
                      <span style={{width: 80, textAlign: "right", fontSize: 11,
                                    color: T.textSubtle, fontVariantNumeric: "tabular-nums"}}>
                        {ev.when}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}

function MatchesScreen() {
  const pairs = [
    {
      score: 91,
      reasons: ["Foto-hash idéntico", "Dirección coincide", "Precio ±2%"],
      a: PROPERTIES[0],
      b: { ...PROPERTIES[0], title: "Magnífico piso reformado, centro Oviedo", listings: [{ portal: "FOTOCASA" }] },
    },
    {
      score: 73,
      reasons: ["Mismas habitaciones y m²", "Misma ciudad y barrio"],
      a: PROPERTIES[1],
      b: { ...PROPERTIES[1], title: "Casa con jardín cerca de la playa de Poo", listings: [{ portal: "PISOS_COM" }] },
    },
  ];
  return (
    <>
      <PageHeader title="Posibles duplicados" description={`${pairs.length} pares pendientes de revisión`}/>
      <div style={{display: "flex", flexDirection: "column", gap: 16}}>
        {pairs.map((m, i) => (
          <Card key={i}>
            <CardHeader title={`Coincidencia ${m.score}%`}>
              <div style={{display: "flex", gap: 8}}>
                <Button size="sm" variant="secondary">Descartar</Button>
                <Button size="sm" variant="primary">Fusionar</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div style={{display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16}}>
                {m.reasons.map((r, j) => <Badge key={j} tone="primary">{r}</Badge>)}
              </div>
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16}}>
                {[m.a, m.b].map((side, j) => (
                  <div key={j} style={{
                    display: "flex", gap: 12, padding: 12, borderRadius: 6,
                    border: `1px solid ${T.border}`, background: T.surfaceMuted,
                  }}>
                    <div style={{width: 88, height: 64, borderRadius: 6, overflow: "hidden",
                                 border: `1px solid ${T.border}`, flexShrink: 0}}>
                      <PropertyImage photo={side.photo}/>
                    </div>
                    <div style={{minWidth: 0}}>
                      <div style={{fontSize: 13, fontWeight: 500, color: T.text,
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                        {side.title}
                      </div>
                      <div style={{fontSize: 12, color: T.textMuted, marginTop: 2}}>
                        {side.city}{side.neighborhood ? ` · ${side.neighborhood}` : ""}
                      </div>
                      <div style={{marginTop: 6, fontSize: 13, fontWeight: 600, color: T.text,
                                   fontVariantNumeric: "tabular-nums"}}>
                        {formatPrice(side.currentPrice)}
                      </div>
                      <div style={{marginTop: 6}}>
                        <Badge>{PORTAL_LABEL[side.listings[0].portal]}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}

// ============================================================
// Root app — handles navigation between screens
// ============================================================

function App() {
  const [route, setRoute] = React.useState({ screen: "properties" });

  const onNavigate = (id) => setRoute({ screen: id });
  const openProperty = (id) => setRoute({ screen: "detail", id });
  const backToProperties = () => setRoute({ screen: "properties" });

  const current = route.screen === "detail" ? "properties" : route.screen;

  return (
    <AppShell current={current} onNavigate={onNavigate}
      onNewProperty={() => alert("Form mock — n/a")}>
      {route.screen === "dashboard"  && <DashboardScreen onOpenProperty={openProperty}/>}
      {route.screen === "properties" && <PropertiesScreen onOpenProperty={openProperty}/>}
      {route.screen === "detail"     && <PropertyDetailScreen propertyId={route.id} onBack={backToProperties}/>}
      {route.screen === "matches"    && <MatchesScreen/>}
      {route.screen === "activity"   && <ActivityScreen/>}
      {route.screen === "searches"   && <div/>}
    </AppShell>
  );
}

window.App = App;
