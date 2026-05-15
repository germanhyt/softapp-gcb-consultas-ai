import cron from "node-cron";
import { generateReport } from "./report-generator";
import { sendReportEmail } from "./email-sender";

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
  lastRun?: string;
  lastResult?: string;
  lastStatus?: "success" | "error";
}

// In-memory store (for production, use a database)
let tasks: ScheduledTask[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cronJobs = new Map<string, any>();

// Default tasks for El Refugio
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
    modelId: "gemini-2.5-flash",
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
    modelId: "gemini-2.5-flash",
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
    modelId: "gemini-2.5-flash",
    active: false,
  },
  {
    id: "daily-sales",
    name: "Reporte Diario de Ventas",
    description: "Resumen de ventas del día anterior",
    cronExpression: "0 7 * * *",
    query:
      "¿Cuáles fueron las ventas de ayer? Desglose por categoría y método de pago.",
    module: "ventas",
    recipients: [],
    modelId: "gemini-2.5-flash",
    active: false,
  },
];

function scheduleJob(task: ScheduledTask) {
  // Stop existing job if any
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
    console.log(`[CronManager] Executing: ${task.name}`);

    try {
      const report = await generateReport(task.query, task.modelId);

      await sendReportEmail({
        to: task.recipients,
        subject: task.name,
        htmlContent: report.content,
        taskName: task.name,
        model: task.modelId,
      });

      // Update task status
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        tasks[idx].lastRun = new Date().toISOString();
        tasks[idx].lastStatus = "success";
        tasks[idx].lastResult = report.content.substring(0, 200) + "...";
      }
    } catch (error) {
      console.error(`[CronManager] Task ${task.id} failed:`, error);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        tasks[idx].lastRun = new Date().toISOString();
        tasks[idx].lastStatus = "error";
        tasks[idx].lastResult = error instanceof Error ? error.message : "Error desconocido";
      }
    }
  });

  cronJobs.set(task.id, job);
  console.log(`[CronManager] Scheduled: ${task.name} (${task.cronExpression})`);
}

export function initializeScheduler() {
  if (tasks.length === 0) {
    tasks = [...DEFAULT_TASKS];
  }
  tasks.filter((t) => t.active).forEach(scheduleJob);
  console.log(`[CronManager] Initialized with ${tasks.length} tasks`);
}

export function getTasks(): ScheduledTask[] {
  return [...tasks];
}

export function updateTask(taskId: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;

  tasks[idx] = { ...tasks[idx], ...updates };
  scheduleJob(tasks[idx]);
  return tasks[idx];
}

export function addTask(task: Omit<ScheduledTask, "id">): ScheduledTask {
  const newTask: ScheduledTask = {
    ...task,
    id: `task_${Date.now()}`,
  };
  tasks.push(newTask);
  scheduleJob(newTask);
  return newTask;
}

export function deleteTask(taskId: string): boolean {
  const existing = cronJobs.get(taskId);
  if (existing) {
    existing.stop();
    cronJobs.delete(taskId);
  }

  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;

  tasks.splice(idx, 1);
  return true;
}

export async function executeTaskNow(taskId: string): Promise<string> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Tarea no encontrada");

  const report = await generateReport(task.query, task.modelId);

  if (task.recipients.length > 0) {
    await sendReportEmail({
      to: task.recipients,
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
  }

  return report.content;
}
