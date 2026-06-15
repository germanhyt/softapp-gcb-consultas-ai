"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useGlobalChat } from "@/contexts/chat-context";
import { AI_PROVIDERS, type ProviderKey } from "@/lib/ai/models";
import {
  Settings,
  Bot,
  Mail,
  Database,
  Key,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertCircle,
  Loader2,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduledReportTasksSettings } from "@/components/settings/scheduled-report-tasks";
import { UsersManagementSettings } from "@/components/settings/users-management";

interface ProviderDisplay {
  key: ProviderKey;
  label: string;
  color: string;
  envVar: string;
}

const PROVIDERS: ProviderDisplay[] = [
  { key: "google", label: "Google (Gemini)", color: "text-blue-600", envVar: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { key: "anthropic", label: "Anthropic (Claude)", color: "text-orange-600", envVar: "ANTHROPIC_API_KEY" },
  { key: "openai", label: "OpenAI (GPT)", color: "text-green-600", envVar: "OPENAI_API_KEY" },
  { key: "deepseek", label: "DeepSeek", color: "text-cyan-600", envVar: "DEEPSEEK_API_KEY" },
];

interface MaskedConfig {
  providers: Record<ProviderKey, { maskedKey: string; hasKey: boolean }>;
  models: Record<string, boolean>;
}

interface MaskedSmtpState {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  maskedPass: string;
  hasPass: boolean;
  ready: boolean;
}

export default function SettingsPage() {
  const { selectedModel, setSelectedModel } = useGlobalChat();
  const allModels = Object.values(AI_PROVIDERS);

  // State
  const [config, setConfig] = useState<MaskedConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<ProviderKey, string>>({
    google: "",
    anthropic: "",
    openai: "",
    deepseek: "",
  });
  const [modelStates, setModelStates] = useState<Record<string, boolean>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<ProviderKey, boolean>>({
    google: false,
    anthropic: false,
    openai: false,
    deepseek: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [hideNegociosSinVentas, setHideNegociosSinVentas] = useState(true);
  const [dashPrefSaving, setDashPrefSaving] = useState(false);
  const [dashPrefMessage, setDashPrefMessage] = useState<string | null>(null);

  const [smtpMask, setSmtpMask] = useState<MaskedSmtpState | null>(null);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpPassVisible, setSmtpPassVisible] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);

  // Load dashboard preferences on mount
  useEffect(() => {
    fetch("/api/settings/dashboard")
      .then((r) => r.json())
      .then((j: { hideNegociosSinVentas?: boolean }) => {
        if (typeof j.hideNegociosSinVentas === "boolean") {
          setHideNegociosSinVentas(j.hideNegociosSinVentas);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/smtp")
      .then((r) => r.json())
      .then((data: MaskedSmtpState) => {
        if (data && typeof data.host === "string") {
          setSmtpMask(data);
          setSmtpHost(data.host);
          setSmtpPort(data.port);
          setSmtpSecure(data.secure);
          setSmtpUser(data.user);
          setSmtpFrom(data.from);
          setSmtpPass(data.maskedPass);
        }
      })
      .catch(() => {});
  }, []);

  // Load AI config on mount
  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data: MaskedConfig) => {
        setConfig(data);
        const keys: Record<string, string> = {};
        for (const p of PROVIDERS) {
          keys[p.key] = data.providers[p.key]?.maskedKey || "";
        }
        setApiKeys(keys as Record<ProviderKey, string>);
        setModelStates(data.models || {});
      })
      .catch(() => {
        const defaultModels: Record<string, boolean> = {};
        for (const m of allModels) defaultModels[m.id] = true;
        setModelStates(defaultModels);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const providers: Record<string, { apiKey: string }> = {};
      for (const p of PROVIDERS) {
        providers[p.key] = { apiKey: apiKeys[p.key] };
      }

      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, models: modelStates }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      const updated: MaskedConfig = await res.json();
      setConfig(updated);

      const keys: Record<string, string> = {};
      for (const p of PROVIDERS) {
        keys[p.key] = updated.providers[p.key]?.maskedKey || "";
      }
      setApiKeys(keys as Record<ProviderKey, string>);
      setModelStates(updated.models || {});

      setSaveResult({ ok: true, message: "Configuracion guardada correctamente" });

      if (!updated.models[selectedModel]) {
        const firstEnabled = Object.entries(updated.models).find(([, v]) => v);
        if (firstEnabled) setSelectedModel(firstEnabled[0]);
      }
    } catch (err) {
      setSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 4000);
    }
  };

  const saveSmtp = async () => {
    setSmtpSaving(true);
    setSmtpMessage(null);
    try {
      const res = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass,
          from: smtpFrom.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar SMTP");
      }
      const updated: MaskedSmtpState = await res.json();
      setSmtpMask(updated);
      setSmtpPass(updated.maskedPass);
      setSmtpMessage("Configuración SMTP guardada.");
      setTimeout(() => setSmtpMessage(null), 4000);
    } catch (err) {
      setSmtpMessage(err instanceof Error ? err.message : "No se pudo guardar SMTP.");
    } finally {
      setSmtpSaving(false);
    }
  };

  const saveDashboardPrefs = async () => {
    setDashPrefSaving(true);
    setDashPrefMessage(null);
    try {
      const res = await fetch("/api/settings/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideNegociosSinVentas }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }
      setDashPrefMessage("Preferencias del dashboard guardadas.");
      setTimeout(() => setDashPrefMessage(null), 3500);
    } catch (err) {
      setDashPrefMessage(
        err instanceof Error ? err.message : "No se pudo guardar.",
      );
    } finally {
      setDashPrefSaving(false);
    }
  };

  const toggleKeyVisibility = (key: ProviderKey) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleModel = (modelId: string) => {
    setModelStates((prev) => ({ ...prev, [modelId]: !prev[modelId] }));
  };

  // Group models by provider
  const modelsByProvider: Record<string, typeof allModels> = {};
  for (const m of allModels) {
    if (!modelsByProvider[m.provider]) modelsByProvider[m.provider] = [];
    modelsByProvider[m.provider].push(m);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          Configuracion
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura las API keys de los proveedores y activa/desactiva modelos.
        </p>
      </div>

      {/* API Keys Section */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-purple-600" />
          API Keys
        </h3>
        <div className="space-y-4">
          {PROVIDERS.map((p) => {
            const hasKey = config?.providers[p.key]?.hasKey ?? false;
            const currentValue = apiKeys[p.key];
            const isVisible = visibleKeys[p.key];

            return (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className={cn("font-semibold", p.color)}>
                      {p.label}
                    </span>
                    {hasKey ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                        <Check className="h-2.5 w-2.5" /> Configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                        <AlertCircle className="h-2.5 w-2.5" /> Sin configurar
                      </span>
                    )}
                  </label>
                  <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">
                    {p.envVar}
                  </code>
                </div>
                <div className="flex gap-2">
                  <input
                    type={isVisible ? "text" : "password"}
                    value={currentValue}
                    onChange={(e) =>
                      setApiKeys((prev) => ({
                        ...prev,
                        [p.key]: e.target.value,
                      }))
                    }
                    placeholder={hasKey ? "Dejar vacio para mantener actual" : "Ingresa tu API key..."}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility(p.key)}
                    className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors"
                    title={isVisible ? "Ocultar" : "Mostrar"}
                  >
                    {isVisible ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Models Section */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-emerald-600" />
          Modelos de IA
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Activa o desactiva modelos. Solo los modelos activos apareceran en el selector del chat.
        </p>

        <div className="space-y-5">
          {Object.entries(modelsByProvider).map(([providerName, models]) => (
            <div key={providerName}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {providerName}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {models.map((m) => {
                  const isEnabled = modelStates[m.id] ?? true;
                  const isActive = selectedModel === m.id;
                  const providerHasKey =
                    config?.providers[m.providerKey]?.hasKey ?? false;

                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all",
                        isEnabled
                          ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-border bg-muted/30 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{m.icon}</span>
                        <div>
                          <p className="font-semibold text-sm">{m.name}</p>
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="text-[10px] text-emerald-600 font-medium">
                                En uso
                              </span>
                            )}
                            {!providerHasKey && (
                              <span className="text-[10px] text-amber-600">
                                Sin API key
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Toggle visual */}
                      <div
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors",
                          isEnabled
                            ? "bg-emerald-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                            isEnabled ? "translate-x-5" : "translate-x-0.5"
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard (ventas) */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-2">
          <BarChart2 className="h-5 w-5 text-sky-600" />
          Dashboard de ventas
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Por defecto está activo: no se muestran negocios cuya suma de ventas en el rango de fechas es cero
          (tabla, KPIs alineados y gráfico mensual).
        </p>
        <label className="flex items-start gap-2 cursor-pointer max-w-xl">
          <input
            type="checkbox"
            checked={hideNegociosSinVentas}
            onChange={(e) => setHideNegociosSinVentas(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input accent-emerald-600"
          />
          <span className="text-sm font-medium leading-snug">
            Ocultar negocios sin ventas en el período filtrado
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveDashboardPrefs}
            disabled={dashPrefSaving}
          >
            {dashPrefSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar preferencias del dashboard
          </Button>
          {dashPrefMessage && (
            <span
              className={cn(
                "text-xs font-medium",
                dashPrefMessage.includes("guardad")
                  ? "text-emerald-600"
                  : "text-red-600",
              )}
            >
              {dashPrefMessage}
            </span>
          )}
        </div>
      </section>

      {/* Save Button + Feedback */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Guardando..." : "Guardar Configuracion"}
        </Button>

        {saveResult && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              saveResult.ok ? "text-emerald-600" : "text-red-600"
            )}
          >
            {saveResult.ok ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {saveResult.message}
          </div>
        )}
      </div>

      {/* SMTP (Gmail u otro) */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-amber-600" />
          Correo SMTP (reportes)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Para Gmail: host <code className="text-[11px] bg-muted px-1 rounded">smtp.gmail.com</code>,
          puerto <strong>587</strong>, sin SSL directo (usa STARTTLS). Usa una{" "}
          <strong>contraseña de aplicación</strong> si tienes 2FA. Los datos se guardan en{" "}
          <code className="text-[11px] bg-muted px-1 rounded">data/smtp-config.json</code> (no se
          versiona).
        </p>
        {smtpMask && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            {smtpMask.ready ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                <Check className="h-3.5 w-3.5" /> Listo para enviar
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Falta usuario o contraseña
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Host SMTP</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Puerto</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
              className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-emerald-600"
              />
              Conexión segura directa (SSL, p. ej. puerto 465)
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Usuario (correo)</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              autoComplete="username"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Contraseña o contraseña de aplicación
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type={smtpPassVisible ? "text" : "password"}
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={smtpMask?.hasPass ? "Dejar máscara para mantener" : ""}
                className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setSmtpPassVisible((v) => !v)}
                className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors shrink-0"
                title={smtpPassVisible ? "Ocultar" : "Mostrar"}
              >
                {smtpPassVisible ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Remitente &quot;From&quot; (opcional)
            </label>
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder={smtpUser || "mismo que usuario"}
              className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveSmtp}
            disabled={smtpSaving}
            className="gap-1"
          >
            {smtpSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar SMTP
          </Button>
          {smtpMessage && (
            <span
              className={cn(
                "text-xs font-medium",
                smtpMessage.includes("guardada") ? "text-emerald-600" : "text-red-600",
              )}
            >
              {smtpMessage}
            </span>
          )}
        </div>
      </section>

      <ScheduledReportTasksSettings />

      <UsersManagementSettings />

      {/* CuadreTarjetas Connection */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-blue-600" />
          CuadreTarjetas API
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              URL del API
            </label>
            <input
              type="text"
              readOnly
              value={process.env.NEXT_PUBLIC_CT_API_URL || "http://62.169.23.24:8082/api"}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-lg bg-muted/50"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Las credenciales se configuran en .env.local (CT_USERNAME, CT_PASSWORD).
          </p>
        </div>
      </section>

    </div>
  );
}
