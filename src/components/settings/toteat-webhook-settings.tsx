"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Webhook,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Play,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import { VENTAS_PERIOD_LABELS } from "@/lib/scheduler/ventas-report-period";
import type { ToteatWebhookFormat } from "@/lib/toteat/webhook-constants";
import { TOTEAT_WEBHOOK_PATH } from "@/lib/toteat/webhook-constants";

interface MaskedWebhookConfig {
  enabled: boolean;
  hasSecret: boolean;
  maskedSecret: string;
  ready: boolean;
  defaultPeriod: VentasReportPeriodPreset;
  defaultRestaurantId: string;
  defaultHourFrom: number | null;
  defaultHourTo: number | null;
  defaultFormat: ToteatWebhookFormat;
  webhookPath: string;
}

interface ToteatRestaurantOption {
  id: string;
  name: string;
}

type ToteatHourPreset = "all_day" | "morning_shift" | "afternoon_shift" | "night_shift" | "custom";

const FORMAT_OPTIONS: { value: ToteatWebhookFormat; label: string }[] = [
  { value: "both", label: "JSON resumen + markdown" },
  { value: "json", label: "Solo JSON resumen" },
  { value: "markdown", label: "Solo markdown" },
  { value: "csv", label: "Solo CSV (texto)" },
  { value: "full", label: "Completo (data + markdown + csv)" },
];

function parseOptionalHour(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const h = Number(s);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

function getHourPreset(from: string, to: string): ToteatHourPreset {
  if (from === "8" && to === "11") return "morning_shift";
  if (from === "12" && to === "15") return "afternoon_shift";
  if (from === "16" && to === "7") return "night_shift";
  if (!from.trim() && !to.trim()) return "all_day";
  return "custom";
}

export function ToteatWebhookSettings() {
  const [config, setConfig] = useState<MaskedWebhookConfig | null>(null);
  const [restaurants, setRestaurants] = useState<ToteatRestaurantOption[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);
  const [defaultPeriod, setDefaultPeriod] = useState<VentasReportPeriodPreset>("yesterday");
  const [defaultRestaurantId, setDefaultRestaurantId] = useState("");
  const [hourFrom, setHourFrom] = useState("");
  const [hourTo, setHourTo] = useState("");
  const [defaultFormat, setDefaultFormat] = useState<ToteatWebhookFormat>("both");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testPreview, setTestPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${TOTEAT_WEBHOOK_PATH}`
      : TOTEAT_WEBHOOK_PATH;

  const load = useCallback(() => {
    fetch("/api/settings/toteat-webhook")
      .then((r) => r.json())
      .then((data: MaskedWebhookConfig) => {
        if (data && typeof data.enabled === "boolean") {
          setConfig(data);
          setEnabled(data.enabled);
          setSecret(data.maskedSecret);
          setDefaultPeriod(data.defaultPeriod);
          setDefaultRestaurantId(data.defaultRestaurantId);
          setHourFrom(
            data.defaultHourFrom !== null && data.defaultHourFrom !== undefined
              ? String(data.defaultHourFrom)
              : "",
          );
          setHourTo(
            data.defaultHourTo !== null && data.defaultHourTo !== undefined
              ? String(data.defaultHourTo)
              : "",
          );
          setDefaultFormat(data.defaultFormat);
        }
      })
      .catch(() => {});

    fetch("/api/toteat/restaurants")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRestaurants(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyHourPreset = (preset: ToteatHourPreset) => {
    if (preset === "all_day") {
      setHourFrom("");
      setHourTo("");
      return;
    }
    if (preset === "morning_shift") {
      setHourFrom("8");
      setHourTo("11");
      return;
    }
    if (preset === "afternoon_shift") {
      setHourFrom("12");
      setHourTo("15");
      return;
    }
    if (preset === "night_shift") {
      setHourFrom("16");
      setHourTo("7");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/toteat-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          secret,
          defaultPeriod,
          defaultRestaurantId,
          defaultHourFrom: parseOptionalHour(hourFrom),
          defaultHourTo: parseOptionalHour(hourTo),
          defaultFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setConfig(data);
      setSecret(data.maskedSecret);
      setMessage("Configuración guardada");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    setTestPreview(null);
    try {
      const res = await fetch("/api/settings/toteat-webhook", { method: "PUT" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error en prueba");
      setTestPreview(data.preview as string);
      setMessage(`Prueba OK (${data.start_date} → ${data.end_date})`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error en prueba");
    } finally {
      setTesting(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("No se pudo copiar la URL");
    }
  };

  return (
    <section className="border rounded-xl p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-2">
        <Webhook className="h-5 w-5 text-emerald-600" />
        Webhook Toteat (n8n / Telegram)
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Expone el <strong>reporte de ventas Bar Refugio</strong> vía HTTP para integraciones externas
        (p. ej. n8n → Telegram). Requiere un secret; también puedes definir{" "}
        <code className="text-[11px] bg-muted px-1 rounded">TOTEAT_WEBHOOK_SECRET</code> en{" "}
        <code className="text-[11px] bg-muted px-1 rounded">.env.local</code> (tiene prioridad).
        Configuración en{" "}
        <code className="text-[11px] bg-muted px-1 rounded">data/toteat-webhook-config.json</code>.
      </p>

      {config && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          {config.ready ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" /> Webhook activo y listo
            </span>
          ) : config.enabled && !config.hasSecret ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Activado pero falta secret
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Webhook desactivado
            </span>
          )}
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg bg-muted/40 border text-xs space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[11px] break-all">{webhookUrl}</code>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={copyUrl}>
            <Copy className="h-3 w-3 mr-1" />
            {copied ? "Copiado" : "Copiar URL"}
          </Button>
        </div>
        <p className="text-muted-foreground">
          Autenticación: header{" "}
          <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;secret&gt;</code> o{" "}
          <code className="bg-muted px-1 rounded">X-Webhook-Secret</code>. Parámetros opcionales:{" "}
          <code className="bg-muted px-1 rounded">period</code>,{" "}
          <code className="bg-muted px-1 rounded">start_date</code>,{" "}
          <code className="bg-muted px-1 rounded">end_date</code>,{" "}
          <code className="bg-muted px-1 rounded">hour_from</code>,{" "}
          <code className="bg-muted px-1 rounded">hour_to</code>,{" "}
          <code className="bg-muted px-1 rounded">format</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            Webhook activo
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Secret</label>
          <div className="mt-1 flex gap-2">
            <input
              type={secretVisible ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={config?.hasSecret ? "Dejar máscara para mantener" : "Genera un token largo"}
              className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setSecretVisible((v) => !v)}
            >
              {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Periodo por defecto</label>
          <select
            value={defaultPeriod}
            onChange={(e) => setDefaultPeriod(e.target.value as VentasReportPeriodPreset)}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {(Object.entries(VENTAS_PERIOD_LABELS) as [VentasReportPeriodPreset, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Formato por defecto</label>
          <select
            value={defaultFormat}
            onChange={(e) => setDefaultFormat(e.target.value as ToteatWebhookFormat)}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Restaurante Toteat</label>
          <select
            value={defaultRestaurantId}
            onChange={(e) => setDefaultRestaurantId(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">Por defecto (Bar Refugio)</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Turno por defecto</label>
          <select
            value={getHourPreset(hourFrom, hourTo)}
            onChange={(e) => applyHourPreset(e.target.value as ToteatHourPreset)}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="all_day">Todo el día</option>
            <option value="morning_shift">Mañana (8–11)</option>
            <option value="afternoon_shift">Tarde (12–15)</option>
            <option value="night_shift">Noche (16–7)</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {getHourPreset(hourFrom, hourTo) === "custom" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hora desde (0–23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={hourFrom}
                onChange={(e) => setHourFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hora hasta (0–23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={hourTo}
                onChange={(e) => setHourTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar webhook
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Probar generación
        </Button>
        {message && (
          <span
            className={cn(
              "text-xs font-medium",
              message.includes("OK") || message.includes("guardada")
                ? "text-emerald-600"
                : "text-red-600",
            )}
          >
            {message}
          </span>
        )}
      </div>

      {testPreview && (
        <pre className="mt-4 p-3 text-[11px] leading-relaxed rounded-lg bg-muted/50 border overflow-x-auto whitespace-pre-wrap max-h-48">
          {testPreview}
        </pre>
      )}
    </section>
  );
}
