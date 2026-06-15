/** Rango de fechas de datos para reportes del módulo ventas (zona America/Lima). */
export type VentasReportPeriodPreset =
  | "yesterday"
  | "yesterday_to_today"
  | "last_7_days"
  | "last_30_days"
  | "last_complete_week"
  | "this_week"
  | "this_month";

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  query: string;
  module: string;
  recipients: string[];
  modelId: string;
  active: boolean;
  /** Solo aplica si module === "ventas" o "toteat". Si no se define, equivale a "yesterday". */
  ventasReportPeriod?: VentasReportPeriodPreset;
  /** Solo aplica si module === "toteat". Si no se define, usa el restaurante por defecto. */
  toteatRestaurantId?: string;
  /** Solo aplica si module === "toteat". Hora inicio filtro (0-23, Lima). */
  toteatHourFrom?: number | null;
  /** Solo aplica si module === "toteat". Hora fin filtro (0-23, Lima). */
  toteatHourTo?: number | null;
  lastRun?: string;
  lastResult?: string;
  lastStatus?: "success" | "error";
}
