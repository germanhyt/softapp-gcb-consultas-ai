import cron from "node-cron";
import { generateReport } from "./report-generator";
import { sendReportEmail } from "./email-sender";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import type { ScheduledTask, VentasReportPeriodPreset } from "./types";
import { appendVentasPeriodToQuery } from "./ventas-report-period";
import {
  readSchedulerTasksFromDisk,
  writeSchedulerTasksToDisk,
} from "./tasks-persistence";

export type { ScheduledTask, VentasReportPeriodPreset } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cronJobs = new Map<string, any>();

let tasks: ScheduledTask[] = [];
let schedulerInitialized = false;

const DEFAULT_TASKS: ScheduledTask[] = [
  {
    id: "daily-conciliation",
    name: "Reporte Diario de Conciliación",
    description: "Resumen de cobertura y pendientes del día anterior",
    cronExpression: "0 8 * * 1-6",
    query:
      "¿Cuál es el resumen de conciliación de ayer? Incluye cobertura, vouchers pendientes, diferencias y problemas detectados.",
    module: "cuadre_tarjetas",
    recipients: [],
    modelId: DEFAULT_MODEL_ID,
    active: false,
  },
  {
    id: "orphan-alert",
    name: "Alerta de Vouchers Huérfanos",
    description: "Notifica si hay más de 10 vouchers huérfanos acumulados",
    cronExpression: "0 12 * * 1-5",
    query:
      "¿Cuántos vouchers huérfanos hay acumulados? Si son más de 10, detalla los montos más grandes y sugiere acciones.",
    module: "cuadre_tarjetas",
    recipients: [],
    modelId: DEFAULT_MODEL_ID,
    active: false,
  },
  {
    id: "weekly-summary",
    name: "Resumen Semanal de Conciliación",
    description: "Análisis semanal con tendencias y comparativa",
    cronExpression: "0 9 * * 1",
    query:
      "Dame el resumen semanal de conciliación: cobertura promedio, mejor y peor día, algoritmo más efectivo, y depósitos pendientes.",
    module: "cuadre_tarjetas",
    recipients: [],
    modelId: DEFAULT_MODEL_ID,
    active: false,
  },
  {
    id: "daily-sales",
    name: "Reporte Diario de Ventas",
    description: "Resumen de ventas (periodo configurable en Configuración)",
    cronExpression: "0 7 * * *",
    query:
      "Genera un reporte de ventas con desglose por categoría y método de pago para el periodo indicado al final.",
    module: "ventas",
    recipients: [],
    modelId: DEFAULT_MODEL_ID,
    ventasReportPeriod: "yesterday",
    active: false,
  },
];

function persistTasks(): void {
  writeSchedulerTasksToDisk(tasks);
}

function loadOrSeedTasks(): void {
  const fromDisk = readSchedulerTasksFromDisk();
  if (fromDisk !== null && fromDisk.length > 0) {
    tasks = fromDisk;
  } else {
    tasks = [...DEFAULT_TASKS];
    persistTasks();
  }
}

function scheduleJob(task: ScheduledTask) {
  const existing = cronJobs.get(task.id);
  if (existing) {
    existing.stop();
    cronJobs.delete(task.id);
  }

  if (!task.active || task.recipients.length === 0) return;

  if (!cron.validate(task.cronExpression)) {
    console.error(`[CronManager] Invalid cron: ${task.cronExpression} for ${task.id}`);
    return;
  }

  const job = cron.schedule(task.cronExpression, async () => {
    const current = tasks.find((t) => t.id === task.id);
    if (!current || !current.active || current.recipients.length === 0) return;

    console.log(`[CronManager] Executing: ${current.name}`);

    try {
      const prompt = appendVentasPeriodToQuery(
        current.module,
        current.ventasReportPeriod,
        current.query,
      );
      const report = await generateReport(prompt, current.modelId);

      await sendReportEmail({
        to: current.recipients,
        subject: current.name,
        htmlContent: report.content,
        taskName: current.name,
        model: current.modelId,
      });

      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        tasks[idx].lastRun = new Date().toISOString();
        tasks[idx].lastStatus = "success";
        tasks[idx].lastResult = report.content.substring(0, 200) + "...";
        persistTasks();
      }
    } catch (error) {
      console.error(`[CronManager] Task ${task.id} failed:`, error);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        tasks[idx].lastRun = new Date().toISOString();
        tasks[idx].lastStatus = "error";
        tasks[idx].lastResult = error instanceof Error ? error.message : "Error desconocido";
        persistTasks();
      }
    }
  });

  cronJobs.set(task.id, job);
  console.log(`[CronManager] Scheduled: ${task.name} (${task.cronExpression})`);
}

/**
 * Carga tareas y registra crons. Se invoca desde las rutas API del scheduler
 * (no desde instrumentation: importar el cron aquí arrastra BigQuery/node-cron al bundle del cliente).
 */
export function ensureSchedulerInitialized(): void {
  if (schedulerInitialized) return;
  loadOrSeedTasks();
  tasks.filter((t) => t.active && t.recipients.length > 0).forEach(scheduleJob);
  schedulerInitialized = true;
  console.log(`[CronManager] Initialized with ${tasks.length} tasks`);
}

export function initializeScheduler(): void {
  ensureSchedulerInitialized();
}

export function getTasks(): ScheduledTask[] {
  ensureSchedulerInitialized();
  return [...tasks];
}

export function updateTask(taskId: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
  ensureSchedulerInitialized();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;

  tasks[idx] = { ...tasks[idx], ...updates };
  scheduleJob(tasks[idx]);
  persistTasks();
  return tasks[idx];
}

export function addTask(task: Omit<ScheduledTask, "id">): ScheduledTask {
  ensureSchedulerInitialized();
  const newTask: ScheduledTask = {
    ...task,
    id: `task_${Date.now()}`,
  };
  tasks.push(newTask);
  scheduleJob(newTask);
  persistTasks();
  return newTask;
}

export function deleteTask(taskId: string): boolean {
  ensureSchedulerInitialized();
  const existing = cronJobs.get(taskId);
  if (existing) {
    existing.stop();
    cronJobs.delete(taskId);
  }

  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;

  tasks.splice(idx, 1);
  persistTasks();
  return true;
}

export interface ExecuteTaskOptions {
  /** Si se indica y no está vacío, sustituye a los destinatarios de la tarea solo para este envío. */
  recipients?: string[];
  /** Si es true, no se envía correo aunque haya destinatarios. */
  skipEmail?: boolean;
  /** Solo ventas: periodo de datos para esta ejecución (si no se envía, se usa el guardado en la tarea). */
  ventasReportPeriod?: VentasReportPeriodPreset;
}

export interface ExecuteTaskResult {
  content: string;
  emailSent: boolean;
}

export async function executeTaskNow(
  taskId: string,
  options?: ExecuteTaskOptions,
): Promise<ExecuteTaskResult> {
  ensureSchedulerInitialized();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Tarea no encontrada");

  const period: VentasReportPeriodPreset | undefined =
    options?.ventasReportPeriod !== undefined
      ? options.ventasReportPeriod
      : task.ventasReportPeriod;
  const prompt = appendVentasPeriodToQuery(task.module, period, task.query);
  const report = await generateReport(prompt, task.modelId);

  const rawRecipients =
    options?.recipients !== undefined
      ? options.recipients
      : task.recipients;
  const to = Array.isArray(rawRecipients)
    ? rawRecipients.map((e) => String(e).trim()).filter(Boolean)
    : [];

  let emailSent = false;
  if (!options?.skipEmail && to.length > 0) {
    emailSent = await sendReportEmail({
      to,
      subject: `[Manual] ${task.name}`,
      htmlContent: report.content,
      taskName: task.name,
      model: task.modelId,
    });
  }

  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    tasks[idx].lastRun = new Date().toISOString();
    tasks[idx].lastStatus = "success";
    tasks[idx].lastResult = report.content.substring(0, 200) + "...";
    persistTasks();
  }

  return { content: report.content, emailSent };
}
