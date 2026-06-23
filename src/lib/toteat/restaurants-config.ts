export interface ToteatRestaurantConfig {
  id: string;
  name: string;
  baseUrl: string;
  xir: string;
  xil: string;
  xiu: string;
  xapitoken: string;
  timeoutMs: number;
}

interface RawRestaurantConfig {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  label?: unknown;
  baseUrl?: unknown;
  xir?: unknown;
  xil?: unknown;
  xiu?: unknown;
  xapitoken?: unknown;
  timeoutMs?: unknown;
}

function toSafeId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function mapRawRestaurant(raw: RawRestaurantConfig, index: number): ToteatRestaurantConfig | null {
  const nameRaw = String(raw.name ?? raw.label ?? "").trim();
  const name = nameRaw || `Restaurante ${index + 1}`;
  const idRaw = String(raw.id ?? raw.key ?? name).trim();
  const id = toSafeId(idRaw) || `restaurante-${index + 1}`;
  const baseUrl = normalizeBaseUrl(
    String(raw.baseUrl ?? process.env.TOTEAT_BASE_URL ?? "https://api.toteat.com/mw/or/1.0").trim(),
  );
  const xir = String(raw.xir ?? "").trim();
  const xil = String(raw.xil ?? "").trim();
  const xiu = String(raw.xiu ?? "").trim();
  const xapitoken = String(raw.xapitoken ?? "").trim();
  const timeoutCandidate = Number(raw.timeoutMs ?? process.env.TOTEAT_TIMEOUT_MS ?? 20000);
  const timeoutMs = Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : 20000;

  if (!xir || !xil || !xiu || !xapitoken) return null;

  return {
    id,
    name,
    baseUrl,
    xir,
    xil,
    xiu,
    xapitoken,
    timeoutMs,
  };
}

function parseFromJsonEnv(): ToteatRestaurantConfig[] {
  const rawJson = process.env.TOTEAT_RESTAURANTS_JSON;
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => mapRawRestaurant((item || {}) as RawRestaurantConfig, index))
      .filter((item): item is ToteatRestaurantConfig => Boolean(item));
  } catch {
    return [];
  }
}

function parseSingleFromEnv(): ToteatRestaurantConfig[] {
  const baseUrl = normalizeBaseUrl(
    (process.env.TOTEAT_BASE_URL || "https://api.toteat.com/mw/or/1.0").trim(),
  );
  const xir = (process.env.TOTEAT_XIR || "").trim();
  const xil = (process.env.TOTEAT_XIL || "").trim();
  const xiu = (process.env.TOTEAT_XIU || "").trim();
  const xapitoken = (process.env.TOTEAT_XAPITOKEN || "").trim();
  const timeoutCandidate = Number(process.env.TOTEAT_TIMEOUT_MS || 20000);
  const timeoutMs = Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : 20000;
  const name = (process.env.TOTEAT_RESTAURANT_NAME || "Bar Refugio").trim();
  const id = toSafeId(process.env.TOTEAT_RESTAURANT_ID || "default") || "default";

  if (!xir || !xil || !xiu || !xapitoken) return [];

  return [{ id, name, baseUrl, xir, xil, xiu, xapitoken, timeoutMs }];
}

export function getToteatRestaurants(): ToteatRestaurantConfig[] {
  const multi = parseFromJsonEnv();
  if (multi.length > 0) return multi;
  return parseSingleFromEnv();
}

export function resolveToteatRestaurant(id?: string | null): ToteatRestaurantConfig | null {
  const restaurants = getToteatRestaurants();
  if (!restaurants.length) return null;
  if (!id) return restaurants[0];
  const byId = restaurants.find((r) => r.id === id);
  return byId || restaurants[0];
}

export function getToteatRestaurantsPublic() {
  return getToteatRestaurants().map((r) => ({ id: r.id, name: r.name }));
}
