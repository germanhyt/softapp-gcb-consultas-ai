"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Store, ListOrdered, CreditCard, Package, Clock } from "lucide-react";
import { TrendCharts, ChartsData } from "@/components/dashboard/trend-charts";
import { BusinessSplitPanel } from "@/components/toteat/business-split-panel";
import { formatSoles } from "@/lib/config/column-rules";
import { TOTEAT_SALES_REPORT_NAME } from "@/lib/toteat/source-context";

interface ToteatDashboardResponse {
  restaurant?: { id: string; name: string };
  start_date: string;
  end_date: string;
  applied_filters?: { hour_from: number | null; hour_to: number | null; timezone?: string };
  total_sales: number;
  total_sales_after_discounts: number;
  total_taxes: number;
  total_net_sales: number;
  total_paid: number;
  total_discounts: number;
  total_gratuity: number;
  orders_count: number;
  payments_count: number;
  clients_count: number;
  average_ticket_gross: number;
  average_ticket_net: number;
  average_ticket_per_client: number;
  charts: ChartsData;
  top_waiters: Array<{ waiterName: string; sales: number; orders: number }>;
  payment_methods: Array<{ name: string; amount: number; count: number }>;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  business_split?: {
    rules: string[];
    by_business: Array<{
      business: "Sisa" | "Limanesas" | "Refugio";
      total: number;
      percentage: number;
      line_items: number;
      orders: number;
      average_ticket: number;
    }>;
    total: number;
  };
  cancellations?: {
    records: number;
    canceled_orders: number;
    canceled_item_lines: number;
    canceled_item_estimated_amount: number;
    canceled_payments_amount: number;
    by_status: Array<{ status: string; count: number }>;
    top_comments: Array<{ comment: string; count: number }>;
  };
  fiscal_documents?: {
    available: boolean;
    total: number;
    by_type: Array<{ type: string; count: number }>;
    message: string;
  };
  error?: string;
}

interface ToteatRestaurantOption {
  id: string;
  name: string;
}

type ShiftPreset = "all_day" | "morning_shift" | "afternoon_shift" | "night_shift";

function defaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`,
  };
}

export default function ToteatDashboardPage() {
  const defaults = defaultRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [restaurants, setRestaurants] = useState<ToteatRestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [shiftPreset, setShiftPreset] = useState<ShiftPreset>("all_day");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ToteatDashboardResponse | null>(null);

  const hourRangeByPreset: Record<ShiftPreset, { from: string; to: string }> = {
    all_day: { from: "", to: "" },
    morning_shift: { from: "8", to: "11" },
    afternoon_shift: { from: "12", to: "15" },
    night_shift: { from: "16", to: "7" },
  };
  const shiftLabelByPreset: Record<ShiftPreset, string> = {
    all_day: "Todos los turnos",
    morning_shift: "Mañana (08:00–11:59)",
    afternoon_shift: "Tarde (12:00–15:59)",
    night_shift: "Noche (16:00–07:59)",
  };

  useEffect(() => {
    fetch("/api/toteat/restaurants")
      .then((r) => r.json())
      .then((j: { restaurants?: ToteatRestaurantOption[] }) => {
        const list = Array.isArray(j.restaurants) ? j.restaurants : [];
        setRestaurants(list);
        if (list.length > 0) {
          setSelectedRestaurant((prev) => prev || list[0].id);
          return;
        }
        setLoading(false);
        setError("No hay restaurantes Toteat configurados.");
      })
      .catch(() => {
        setRestaurants([]);
        setLoading(false);
        setError("No se pudo cargar la configuración de restaurantes.");
      });
  }, []);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || startDate > endDate) return;
    if (!selectedRestaurant) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        restaurant: selectedRestaurant,
      });
      const range = hourRangeByPreset[shiftPreset];
      if (range.from !== "") params.set("hour_from", range.from);
      if (range.to !== "") params.set("hour_to", range.to);
      const res = await fetch(`/api/toteat/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as ToteatDashboardResponse;
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedRestaurant, shiftPreset]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const hasCharts = Boolean(
    data &&
      (data.charts.por_turno.length > 0 ||
        data.charts.por_dia.length > 0 ||
        data.charts.por_hora.length > 0),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            Consultas Toteat
          </h2>
          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            Reporte de ventas {TOTEAT_SALES_REPORT_NAME} — datos en vivo desde API Toteat
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 disabled:opacity-40 self-start sm:self-auto"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground-muted)",
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div
        className="rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--foreground-subtle)" }}>
          Rango:
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-xs rounded-lg px-2 py-1.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
        />
        <span className="text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
          →
        </span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-xs rounded-lg px-2 py-1.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
        />
        {restaurants.length > 0 && (
          <>
            <span className="text-[10px] font-bold uppercase tracking-widest ml-2" style={{ color: "var(--foreground-subtle)" }}>
              Restaurante:
            </span>
            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest ml-2 flex items-center gap-1" style={{ color: "var(--foreground-subtle)" }}>
          <Clock className="h-3 w-3" />
          Turno:
        </span>
        <select
          value={shiftPreset}
          onChange={(e) => setShiftPreset(e.target.value as ShiftPreset)}
          className="text-xs rounded-lg px-2 py-1.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
        >
          <option value="all_day">Todo el día</option>
          <option value="morning_shift">Mañana (08:00–11:59)</option>
          <option value="afternoon_shift">Tarde (12:00–15:59)</option>
          <option value="night_shift">Noche (16:00–07:59)</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "rgba(214,84,84,0.08)",
            border: "1px solid rgba(214,84,84,0.25)",
            color: "var(--tertiary)",
          }}
        >
          No se pudo cargar Toteat: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.restaurant?.name && (
            <div className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
              Restaurante seleccionado: {data.restaurant.name}
              {(data.applied_filters?.hour_from != null || data.applied_filters?.hour_to != null) && (
                <span>
                  {" "}· Turno aplicado ({data.applied_filters.timezone || "America/Lima"}):{" "}
                  {data.applied_filters.hour_from != null
                    ? `${String(data.applied_filters.hour_from).padStart(2, "0")}:00`
                    : "00:00"}
                  {" → "}
                  {data.applied_filters.hour_to != null
                    ? `${String(data.applied_filters.hour_to).padStart(2, "0")}:59`
                    : "23:59"}
                  {data.applied_filters.hour_from != null &&
                    data.applied_filters.hour_to != null &&
                    data.applied_filters.hour_from > data.applied_filters.hour_to && (
                      <span> (cruza día)</span>
                    )}
                </span>
              )}
              <span> · {shiftLabelByPreset[shiftPreset]}</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: "rgba(56,209,73,0.07)", border: "1px solid rgba(56,209,73,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Venta Bruta</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_sales)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Pagado</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_paid)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Órdenes</p>
              <p className="text-xl font-bold tabular-nums">{data.orders_count.toLocaleString("es-PE")}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(255,159,67,0.07)", border: "1px solid rgba(255,159,67,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Propinas</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_gratuity)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Bruta - Descuentos</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_sales_after_discounts)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Impuestos</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_taxes)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Venta Neta</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_net_sales)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(214,84,84,0.07)", border: "1px solid rgba(214,84,84,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Descuentos</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.total_discounts)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: "rgba(56,209,73,0.07)", border: "1px solid rgba(56,209,73,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Ticket prom. (bruto)</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.average_ticket_gross)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.20)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Ticket prom. (neto)</p>
              <p className="text-xl font-bold tabular-nums">{formatSoles(data.average_ticket_net)}</p>
            </div>
            {data.clients_count > 0 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Ticket / comensal</p>
                <p className="text-xl font-bold tabular-nums">{formatSoles(data.average_ticket_per_client)}</p>
              </div>
            )}
            {data.clients_count > 0 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Comensales</p>
                <p className="text-xl font-bold tabular-nums">{data.clients_count.toLocaleString("es-PE")}</p>
              </div>
            )}
          </div>

          {data.cancellations && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl p-4" style={{ background: "rgba(214,84,84,0.07)", border: "1px solid rgba(214,84,84,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Órdenes c/ cancelación</p>
                <p className="text-xl font-bold tabular-nums">{data.cancellations.records.toLocaleString("es-PE")}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(214,84,84,0.07)", border: "1px solid rgba(214,84,84,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Órdenes anuladas</p>
                <p className="text-xl font-bold tabular-nums">{data.cancellations.canceled_orders.toLocaleString("es-PE")}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(214,84,84,0.07)", border: "1px solid rgba(214,84,84,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Líneas canceladas</p>
                <p className="text-xl font-bold tabular-nums">{data.cancellations.canceled_item_lines.toLocaleString("es-PE")}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(214,84,84,0.07)", border: "1px solid rgba(214,84,84,0.20)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>Monto cancelado (estim.)</p>
                <p className="text-xl font-bold tabular-nums">{formatSoles(data.cancellations.canceled_item_estimated_amount)}</p>
              </div>
            </div>
          )}

          {hasCharts && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <TrendCharts data={data.charts} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Store className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-semibold">Top Meseros</h3>
              </div>
              <div className="space-y-2">
                {data.top_waiters.slice(0, 8).map((w) => (
                  <div key={w.waiterName} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--foreground-muted)" }}>{w.waiterName}</span>
                    <span className="font-semibold tabular-nums">{formatSoles(w.sales)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-semibold">Medios de Pago</h3>
              </div>
              <div className="space-y-2">
                {data.payment_methods.slice(0, 8).map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--foreground-muted)" }}>{m.name}</span>
                    <span className="font-semibold tabular-nums">{formatSoles(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-semibold">Top Productos</h3>
              </div>
              <div className="space-y-2">
                {data.top_products.slice(0, 8).map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--foreground-muted)" }}>{p.name}</span>
                    <span className="font-semibold tabular-nums">
                      <ListOrdered className="h-3 w-3 inline mr-1" />
                      {p.quantity.toLocaleString("es-PE")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {data.business_split && <BusinessSplitPanel data={data.business_split} />}

          {/* {data.cancellations && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3">Cancelaciones por estado</h3>
                <div className="space-y-2">
                  {data.cancellations.by_status.map((row) => (
                    <div key={row.status} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--foreground-muted)" }}>{row.status}</span>
                      <span className="font-semibold tabular-nums">{row.count.toLocaleString("es-PE")}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3">Motivos/comentarios frecuentes</h3>
                <div className="space-y-2">
                  {data.cancellations.top_comments.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Sin comentarios de cancelación en el período.</p>
                  )}
                  {data.cancellations.top_comments.map((row) => (
                    <div key={row.comment} className="flex items-center justify-between gap-2 text-xs">
                      <span style={{ color: "var(--foreground-muted)" }} className="truncate">{row.comment}</span>
                      <span className="font-semibold tabular-nums">{row.count.toLocaleString("es-PE")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.fiscal_documents && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-1">Documentos fiscales</h3>
              <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
                {data.fiscal_documents.message}
              </p>
              {data.fiscal_documents.available ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold">Total documentos: {data.fiscal_documents.total.toLocaleString("es-PE")}</div>
                  {data.fiscal_documents.by_type.map((row) => (
                    <div key={row.type} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--foreground-muted)" }}>{row.type}</span>
                      <span className="font-semibold tabular-nums">{row.count.toLocaleString("es-PE")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Este endpoint no está habilitado para este ambiente/credenciales.
                </p>
              )}
            </div>
          )} */}
        </>
      )}
    </div>
  );
}
