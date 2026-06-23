export type ToteatWebhookFormat = "json" | "markdown" | "csv" | "full" | "both";

export const TOTEAT_WEBHOOK_PATH = "/api/webhooks/toteat/report";

export const TOTEAT_WEBHOOK_FORMATS: ToteatWebhookFormat[] = [
  "json",
  "markdown",
  "csv",
  "full",
  "both",
];
