"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { observedAt: string | Date; price: number };

export function PriceHistoryChart({ data }: { data: Point[] }) {
  const series = data.map((d) => ({
    date: new Date(d.observedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    price: d.price / 100,
  }));

  if (series.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-text-subtle">Sin histórico de precios.</div>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A5F8A" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#3A5F8A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8E6E1" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#9A9690", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#9A9690", fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E8E6E1",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(20,20,18,.06)",
            }}
            formatter={(v: number) => [`${v.toLocaleString("es-ES")} €`, "Precio"]}
          />
          <Area type="monotone" dataKey="price" stroke="#3A5F8A" strokeWidth={2} fill="url(#priceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
