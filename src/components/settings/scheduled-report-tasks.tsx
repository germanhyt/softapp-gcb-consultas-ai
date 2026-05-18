"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  RefreshCw,
  Loader2,
  Save,
  Send,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import { VENTAS_PERIOD_LABELS } from "@/lib/scheduler/ventas-report-period";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  query: string;
  module: string;
  recipients: string[];
  modelId: string;
  active: boolean;
  ventasReportPeriod?: VentasReportPeriodPreset;
  lastRun?: string;
  lastResult?: string;
  lastStatus?: "success" | "error";
}

type TaskDraft = {
  recipients: string;
  cron: string;
  ventasPeriod: VentasReportPeriodPreset;
};

function recipientsToText(recipients: string[]): string {
  return recipients.join(", ");
}

const CRON_HELP: Record<string, string> = {
  "0 7 * * *": "Todos los días 7:00",
  "0 8 * * 1-6": "Lun–Sáb 8:00",
  "0 12 * * 1-5": "Lun–Vie 12:00",
  "0 9 * * 1": "Lunes 9:00",
};

function formatCron(expr: string): string {
  return CRON_HELP[expr] || expr;
}

export function ScheduledReportTasksSettings() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executeMode, setExecuteMode] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const syncDraftsFromTasks = useCallback((list: ScheduledTask[]) => {
    const next: Record<string, TaskDraft> = {};
    for (const t of list) {
      next[t.id] = {
        recipients: recipientsToText(t.recipients),
        cron: t.cronExpression,
        ventasPeriod: t.module === "ventas" ? t.ventasReportPeriod ?? "yesterday" : "yesterday",
      };
    }
    setDrafts(next);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
        syncDraftsFromTasks(data);
      }
    } catch {
      console.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [syncDraftsFromTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const showBanner = (tone: "ok" | "err", text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 5000);
  };

  const parseRecipientsField = (text: string): string[] =>
    text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const saveTask = async (task: ScheduledTask) => {
    const d = drafts[task.id];
    if (!d) return;
    setSavingId(task.id);
    try {
      const recipients = parseRecipientsField(d.recipients);
      const body: Record<string, unknown> = {
        id: task.id,
        recipients,
        cronExpression: d.cron.trim(),
      };
      if (task.module === "ventas") {
        body.ventasReportPeriod = d.ventasPeriod ?? "yesterday";
      }
      const res = await fetch("/api/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo guardar");
      }
      await fetchTasks();
      showBanner("ok", "Programación guardada.");
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  const toggleTask = async (task: ScheduledTask) => {
    const res = await fetch("/api/scheduler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, active: !task.active }),
    });
    if (res.ok) {
      await fetchTasks();
      showBanner("ok", !task.active ? "Tarea activada." : "Tarea desactivada.");
    }
  };

  const runTask = async (taskId: string, opts: { skipEmail: boolean }) => {
    const task = tasks.find((t) => t.id === taskId);
    const d = task ? drafts[task.id] : null;
    const customRecipients =
      d && d.recipients.trim() ? parseRecipientsField(d.recipients) : undefined;

    setExecuting(taskId);
    setExecuteMode(opts.skipEmail ? "no-mail" : "mail");
    try {
      const res = await fetch("/api/scheduler/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          skipEmail: opts.skipEmail,
          recipients: customRecipients,
          ...(task?.module === "ventas" && d
            ? { ventasReportPeriod: d.ventasPeriod }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error al ejecutar");
      }
      await fetchTasks();
      if (opts.skipEmail) {
        showBanner("ok", "Reporte generado (sin envío de correo).");
      } else if (data.emailSent) {
        showBanner("ok", "Reporte enviado por correo.");
      } else {
        showBanner(
          "err",
          "Reporte generado pero no se envió correo (revisa SMTP o destinatarios).",
        );
      }
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Ejecución fallida");
    } finally {
      setExecuting(null);
      setExecuteMode(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section
      id="reportes-programados"
      className="border rounded-xl p-4 sm:p-6 scroll-mt-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-600" />
          Reportes programados y correo
        </h3>
        <Button variant="outline" size="sm" onClick={() => fetchTasks()} className="gap-1 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Define expresión cron (cuándo se envía), destinatarios y activa el envío automático. En tareas
        de <strong>ventas</strong> puedes elegir el <strong>periodo de datos</strong> (qué fechas se
        analizan; zona Lima). Puedes ejecutar en el momento con o sin correo; si rellenas destinatarios
        aquí, se usan aunque no hayas pulsado Guardar.
      </p>

      {banner && (
        <p
          className={cn(
            "text-sm font-medium mb-4",
            banner.tone === "ok" ? "text-emerald-600" : "text-red-600",
          )}
        >
          {banner.text}
        </p>
      )}

      <div className="space-y-4">
        {tasks.map((task) => {
          const d = drafts[task.id] ?? {
            recipients: recipientsToText(task.recipients),
            cron: task.cronExpression,
            ventasPeriod: task.module === "ventas" ? task.ventasReportPeriod ?? "yesterday" : "yesterday",
          };

          return (
            <div
              key={task.id}
              className={cn(
                "border rounded-lg p-4 transition-all",
                task.active
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/15"
                  : "border-border",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-sm">{task.name}</h4>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        task.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {task.active ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {task.module}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatCron(task.cronExpression)}
                    </span>
                    {task.lastRun && (
                      <span className="flex items-center gap-1">
                        {task.lastStatus === "success" ? (
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        {new Date(task.lastRun).toLocaleString("es-PE")}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Destinatarios (correos separados por coma)
                    </label>
                    <textarea
                      value={d.recipients}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [task.id]: { ...d, recipients: e.target.value },
                        }))
                      }
                      rows={2}
                      placeholder="correo1@gmail.com, correo2@gmail.com"
                      className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y min-h-12"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Expresión cron</label>
                    <input
                      type="text"
                      value={d.cron}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [task.id]: { ...d, cron: e.target.value },
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="0 8 * * 1-6"
                    />
                  </div>

                  {task.module === "ventas" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Periodo de ventas (datos, America/Lima)
                      </label>
                      <select
                        value={d.ventasPeriod}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: {
                              ...d,
                              ventasPeriod: e.target.value as VentasReportPeriodPreset,
                            },
                          }))
                        }
                        className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        {(Object.keys(VENTAS_PERIOD_LABELS) as VentasReportPeriodPreset[]).map((key) => (
                          <option key={key} value={key}>
                            {VENTAS_PERIOD_LABELS[key]}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Los rangos &quot;hasta ayer&quot; evitan el día en curso. &quot;Última semana
                        completa&quot; es un bloque calendario lun–dom (termina el domingo más reciente
                        ≤ ayer). &quot;Últimos 7 días&quot; es ventana móvil de 7 días hasta ayer.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs w-full sm:w-auto"
                    disabled={savingId === task.id}
                    onClick={() => saveTask(task)}
                  >
                    {savingId === task.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Guardar programación
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs w-full sm:w-auto"
                    disabled={executing === task.id}
                    onClick={() => runTask(task.id, { skipEmail: true })}
                  >
                    {executing === task.id && executeMode === "no-mail" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    Solo generar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1 text-xs w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                    disabled={executing === task.id}
                    onClick={() => runTask(task.id, { skipEmail: false })}
                  >
                    {executing === task.id && executeMode === "mail" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Enviar ahora
                  </Button>
                  <Button
                    variant={task.active ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "text-xs w-full sm:w-auto",
                      task.active && "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    onClick={() => toggleTask(task)}
                  >
                    <Play className="h-3 w-3 mr-1 opacity-80" />
                    {task.active ? "Desactivar auto" : "Activar auto"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No hay tareas configuradas.</p>
      )}
    </section>
  );
}
