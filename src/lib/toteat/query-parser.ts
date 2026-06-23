import { getToteatRestaurantsPublic } from "@/lib/toteat/restaurants-config";

export type ToteatQueryFocus =
  | "auto"
  | "summary"
  | "waiters"
  | "products"
  | "payments"
  | "business"
  | "cancellations"
  | "ticket"
  | "charts";

export interface ToteatQueryParams {
  startDate: string;
  endDate: string;
  restaurantId: string | null;
  hourFrom: number | null;
  hourTo: number | null;
  focus: ToteatQueryFocus;
  comparePeriod: { startDate: string; endDate: string } | null;
}

const MONTH_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateToken(token: string, now: Date): Date | null {
  const dmy = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  const ymd = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  if (/^(hoy|today)$/.test(token)) return new Date(now);
  if (/^(ayer|yesterday)$/.test(token)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  return null;
}

function parseDateRangeFromText(text: string, now = new Date()): { startDate: string; endDate: string } {
  const normalized = normalizeText(text);

  const isoMarker = text.match(/\[TOTEAT_RANGO_ISO:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})\]/);
  if (isoMarker) {
    let [startDate, endDate] = [isoMarker[1], isoMarker[2]];
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
    return { startDate, endDate };
  }

  const rangeMatch = text.match(
    /(?:desde|del?|from)\s+(?:el\s+)?([\d/\-]+|hoy|today|ayer)\s+(?:hasta|al?|to|(?:el\s+)?(?:dia\s+)?(?:actual|de\s+hoy|hoy|ayer))\s+([\d/\-]+|hoy|today|ayer|dia\s+actual)?/i,
  );
  if (rangeMatch) {
    const s = parseDateToken(rangeMatch[1].replace(/\s+/g, ""), now);
    const eRaw = (rangeMatch[2] || "hoy").replace(/\s+/g, "");
    const e =
      /diaactual|hoy|today/i.test(eRaw)
        ? now
        : parseDateToken(eRaw, now) ?? now;
    if (s) return { startDate: toISODate(s), endDate: toISODate(s <= e ? e : s) };
  }

  if (/\bhoy\b|\btoday\b|\bdia actual\b|\bfecha actual\b/.test(normalized)) {
    const d = toISODate(now);
    return { startDate: d, endDate: d };
  }

  if (/\bayer\b|\byesterday\b/.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const iso = toISODate(d);
    return { startDate: iso, endDate: iso };
  }

  if (/\bantier\b/.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    const iso = toISODate(d);
    return { startDate: iso, endDate: iso };
  }

  if (/este\s*mes|mes\s*actual|del\s*mes/.test(normalized)) {
    return {
      startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toISODate(now),
    };
  }

  if (/mes\s*pasado|ultimo\s*mes/.test(normalized)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }

  if (/semana\s*pasada|ultima\s*semana/.test(normalized)) {
    const end = new Date(now);
    end.setDate(end.getDate() - end.getDay());
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }

  if (/esta\s*semana|semana\s*actual/.test(normalized)) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    return { startDate: toISODate(start), endDate: toISODate(now) };
  }

  if (/fin\s*de\s*semana|este\s*fin\s*de\s*semana/.test(normalized)) {
    const day = now.getDay();
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + (6 - day));
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    return { startDate: toISODate(saturday), endDate: toISODate(sunday) };
  }

  const dateTokens = [...text.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map((m) => m[1]);
  if (dateTokens.length >= 2) {
    const d1 = parseDateToken(dateTokens[0], now);
    const d2 = parseDateToken(dateTokens[1], now);
    if (d1 && d2) {
      return {
        startDate: toISODate(d1 < d2 ? d1 : d2),
        endDate: toISODate(d1 < d2 ? d2 : d1),
      };
    }
  }
  if (dateTokens.length === 1) {
    const d1 = parseDateToken(dateTokens[0], now);
    if (d1) {
      const iso = toISODate(d1);
      return { startDate: iso, endDate: iso };
    }
  }

  for (const [name, monthIdx] of Object.entries(MONTH_MAP)) {
    if (normalized.includes(name)) {
      const yearMatch = text.match(/\b(202\d)\b/);
      let year = now.getFullYear();
      if (yearMatch) year = parseInt(yearMatch[1]);
      else if (monthIdx > now.getMonth()) year -= 1;
      const firstDay = new Date(year, monthIdx, 1);
      const lastDay = new Date(year, monthIdx + 1, 0);
      return { startDate: toISODate(firstDay), endDate: toISODate(lastDay) };
    }
  }

  const lastNMatch = normalized.match(/ultim[oa]s?\s*(\d+)\s*(mes|dia|semana)/);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1]);
    const unit = lastNMatch[2];
    const start = new Date(now);
    if (unit.startsWith("mes")) start.setMonth(start.getMonth() - n);
    else if (unit.startsWith("dia")) start.setDate(start.getDate() - n);
    else if (unit.startsWith("semana")) start.setDate(start.getDate() - n * 7);
    return { startDate: toISODate(start), endDate: toISODate(now) };
  }

  // Default: mes en curso (alineado con dashboard /toteat)
  return {
    startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toISODate(now),
  };
}

function parseRestaurantId(text: string): string | null {
  const restaurants = getToteatRestaurantsPublic();
  if (restaurants.length === 0) return null;
  const normalized = normalizeText(text);
  for (const r of restaurants) {
    const nameNorm = normalizeText(r.name);
    if (nameNorm.length >= 3 && normalized.includes(nameNorm)) return r.id;
    if (normalized.includes(r.id.replace(/-/g, " "))) return r.id;
  }
  return null;
}

function parseShift(text: string): { hourFrom: number | null; hourTo: number | null } {
  const lower = normalizeText(text);
  if (/\bmanana\b|\bturno\s*manana\b/.test(lower)) return { hourFrom: 8, hourTo: 11 };
  if (/\btarde\b|\bturno\s*tarde\b/.test(lower)) return { hourFrom: 12, hourTo: 15 };
  if (/\bnoche\b|\bturno\s*noche\b/.test(lower)) return { hourFrom: 16, hourTo: 7 };
  return { hourFrom: null, hourTo: null };
}

function parseFocus(text: string): ToteatQueryFocus {
  const lower = normalizeText(text);
  if (/mesero|camarero|garzon|waiter/.test(lower)) return "waiters";
  if (/producto|plato|menu|top\s*product/.test(lower)) return "products";
  if (/medio\s*de\s*pago|pago|tarjeta|efectivo|propina|visa|mastercard/.test(lower)) return "payments";
  if (/cruce|sisa|limanesa|negocio|bar refugio|refugio\/sisa/.test(lower)) return "business";
  if (/cancel|anul/.test(lower)) return "cancellations";
  if (/ticket\s*prom|ticket\s*medio|comensal/.test(lower)) return "ticket";
  if (/por\s*hora|por\s*dia|por\s*turno|grafico|tendencia|horario/.test(lower)) return "charts";
  if (/venta|resumen|total|bruta|neta/.test(lower)) return "summary";
  return "auto";
}

function parseComparePeriod(text: string, now = new Date()): { startDate: string; endDate: string } | null {
  const lower = normalizeText(text);
  if (!/compar|versus|\bvs\b|frente a|respecto a/.test(lower)) return null;

  if (/mes\s*pasado|periodo\s*anterior|semana\s*pasada/.test(lower)) {
    if (/mes\s*pasado/.test(lower)) {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    const end = new Date(now);
    end.setDate(end.getDate() - end.getDay() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }
  return null;
}

/**
 * Resuelve parámetros equivalentes a GET /api/toteat/dashboard a partir del
 * mensaje actual y mensajes previos del usuario (follow-ups).
 */
export function parseToteatQueryParams(
  currentMessage: string,
  priorUserMessages: string[] = [],
): ToteatQueryParams {
  const now = new Date();
  const combined = [...priorUserMessages.slice(-4), currentMessage].join("\n");
  const { startDate, endDate } = parseDateRangeFromText(combined, now);

  let restaurantId = parseRestaurantId(currentMessage);
  if (!restaurantId) restaurantId = parseRestaurantId(combined);

  let { hourFrom, hourTo } = parseShift(currentMessage);
  if (hourFrom === null && hourTo === null) {
    ({ hourFrom, hourTo } = parseShift(combined));
  }

  const focus = parseFocus(currentMessage);
  const comparePeriod = parseComparePeriod(currentMessage, now);

  return {
    startDate,
    endDate,
    restaurantId,
    hourFrom,
    hourTo,
    focus,
    comparePeriod,
  };
}

export function buildToteatApiQueryString(params: ToteatQueryParams): string {
  const q = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.restaurantId) q.set("restaurant", params.restaurantId);
  if (params.hourFrom !== null) q.set("hour_from", String(params.hourFrom));
  if (params.hourTo !== null) q.set("hour_to", String(params.hourTo));
  return `/api/toteat/dashboard?${q.toString()}`;
}
