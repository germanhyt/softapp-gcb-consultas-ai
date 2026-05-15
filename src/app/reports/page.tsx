"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  lastRun?: string;
  lastResult?: string;
  lastStatus?: "success" | "error";
}

export default function ReportsPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/scheduler");
      const data = await res.json();
      setTasks(data);
    } catch {
      console.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const toggleTask = async (task: ScheduledTask) => {
    const res = await fetch("/api/scheduler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, active: !task.active }),
    });
    if (res.ok) fetchTasks();
  };

  const executeNow = async (taskId: string) => {
    setExecuting(taskId);
    try {
      const res = await fetch("/api/scheduler/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch {
      console.error("Execution failed");
    } finally {
      setExecuting(null);
    }
  };

  const formatCron = (expr: string): string => {
    const cronMap: Record<string, string> = {
      "0 7 * * *": "Todos los días 7:00am",
      "0 8 * * 1-6": "L-S 8:00am",
      "0 12 * * 1-5": "L-V 12:00pm",
      "0 9 * * 1": "Lunes 9:00am",
    };
    return cronMap[expr] || expr;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
            Tareas Programadas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reportes automáticos que se ejecutan y envían por email.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTasks}
          className="gap-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "border rounded-xl p-4 sm:p-5 transition-all",
              task.active
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                : "border-border"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {task.name}
                  </h3>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      task.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {task.active ? "Activo" : "Inactivo"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {task.module}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {task.description}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatCron(task.cronExpression)}
                  </span>
                  {task.recipients.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {task.recipients.length} destinatario(s)
                    </span>
                  )}
                </div>

                {task.lastRun && (
                  <div className="flex items-center gap-2 mt-2">
                    {task.lastStatus === "success" ? (
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      Última ejecución:{" "}
                      {new Date(task.lastRun).toLocaleString("es-PE")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => executeNow(task.id)}
                  disabled={executing === task.id}
                  className="gap-1 text-xs"
                >
                  {executing === task.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">Ejecutar</span>
                </Button>
                <Button
                  variant={task.active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTask(task)}
                  className={cn(
                    "text-xs",
                    task.active &&
                      "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  {task.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay tareas programadas configuradas.</p>
        </div>
      )}
    </div>
  );
}
