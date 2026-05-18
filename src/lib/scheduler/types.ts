/** Rango de fechas de datos para reportes del módulo ventas (zona America/Lima). */
export type VentasReportPeriodPreset =
  | "yesterday"
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
  /** Solo aplica si module === "ventas". Si no se define, equivale a "yesterday". */
  ventasReportPeriod?: VentasReportPeriodPreset;
  lastRun?: string;
  lastResult?: string;
  lastStatus?: "success" | "error";
}
