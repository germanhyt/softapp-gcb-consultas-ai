import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type { ScheduledTask } from "./types";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";

function findProjectRootFromCwd(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const hasPackageJson = existsSync(join(currentDir, "package.json"));
    const hasSrcDir = existsSync(join(currentDir, "src"));
    if (hasPackageJson && hasSrcDir) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return startDir;
    currentDir = parentDir;
  }
}

const PROJECT_ROOT = findProjectRootFromCwd(process.cwd());
const DATA_DIR = join(PROJECT_ROOT, "data");
const TASKS_PATH = join(DATA_DIR, "scheduler-tasks.json");

function normalizeTask(raw: unknown): ScheduledTask | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const description = typeof o.description === "string" ? o.description : "";
  const cronExpression = typeof o.cronExpression === "string" ? o.cronExpression : "0 8 * * *";
  const query = typeof o.query === "string" ? o.query : "";
  const module = typeof o.module === "string" ? o.module : "";
  const modelIdRaw = typeof o.modelId === "string" ? o.modelId.trim() : "";
  const modelId = modelIdRaw || DEFAULT_MODEL_ID;
  const active = Boolean(o.active);
  let recipients: string[] = [];
  if (Array.isArray(o.recipients)) {
    recipients = o.recipients
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  }
  const lastRun = typeof o.lastRun === "string" ? o.lastRun : undefined;
  const lastResult = typeof o.lastResult === "string" ? o.lastResult : undefined;
  const lastStatus =
    o.lastStatus === "success" || o.lastStatus === "error" ? o.lastStatus : undefined;

  const PRESETS = new Set([
    "yesterday",
    "last_7_days",
    "last_30_days",
    "last_complete_week",
    "this_week",
    "this_month",
  ]);
  let ventasReportPeriod: ScheduledTask["ventasReportPeriod"] = undefined;
  if (typeof o.ventasReportPeriod === "string" && PRESETS.has(o.ventasReportPeriod)) {
    ventasReportPeriod = o.ventasReportPeriod as ScheduledTask["ventasReportPeriod"];
  }

  if (!id || !name) return null;
  return {
    id,
    name,
    description,
    cronExpression,
    query,
    module,
    recipients,
    modelId,
    active,
    ventasReportPeriod,
    lastRun,
    lastResult,
    lastStatus,
  };
}

export function readSchedulerTasksFromDisk(): ScheduledTask[] | null {
  try {
    if (!existsSync(TASKS_PATH)) return null;
    const raw = JSON.parse(readFileSync(TASKS_PATH, "utf-8"));
    if (!Array.isArray(raw)) return null;
    const out: ScheduledTask[] = [];
    for (const item of raw) {
      const t = normalizeTask(item);
      if (t) out.push(t);
    }
    return out;
  } catch (err) {
    console.error("[SchedulerTasks] read error:", err);
    return null;
  }
}

export function writeSchedulerTasksToDisk(tasks: ScheduledTask[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (err) {
    console.error("[SchedulerTasks] write error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo guardar tareas del programador (${detail}). Ruta: ${TASKS_PATH}`);
  }
}
