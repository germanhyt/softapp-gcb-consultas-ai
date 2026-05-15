"use client";

import { TrendingUp, Target, BarChart2, Store, Sparkles } from "lucide-react";
import { formatSoles } from "@/lib/config/column-rules";

interface KpiCardsProps {
  total: number;
  presupuesto?: number;
  negocio_count: number;
  propinas?: number;
}

export function KpiCards({ total, presupuesto, negocio_count, propinas }: KpiCardsProps) {
  const cumplimiento = presupuesto && presupuesto > 0 ? (total / presupuesto) * 100 : null;

  const cumplColor =
    cumplimiento === null ? "from-slate-500 to-slate-600" :
    cumplimiento >= 100   ? "from-emerald-600 to-emerald-700" :
    cumplimiento >= 80    ? "from-blue-600 to-blue-700" :
    cumplimiento >= 60    ? "from-amber-600 to-amber-700" :
                            "from-red-600 to-red-700";

  const cards = [
    {
      label: "Ventas Totales",
      value: formatSoles(total),
      icon: TrendingUp,
      color: "from-emerald-600 to-emerald-700",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-300 dark:border-emerald-700",
      textColor: "text-emerald-900 dark:text-emerald-100",
    },
    ...(presupuesto
      ? [
          {
            label: "Presupuesto",
            value: formatSoles(presupuesto),
            icon: Target,
            color: "from-blue-600 to-blue-700",
            bg: "bg-blue-50 dark:bg-blue-950/40",
            border: "border-blue-300 dark:border-blue-700",
            textColor: "text-blue-900 dark:text-blue-100",
          },
          {
            label: "Cumplimiento",
            value: cumplimiento !== null ? `${cumplimiento.toFixed(1)}%` : "—",
            icon: BarChart2,
            color: cumplColor,
            bg: cumplimiento !== null && cumplimiento >= 100
              ? "bg-emerald-50 dark:bg-emerald-950/40"
              : "bg-slate-100 dark:bg-zinc-800/60",
            border: "border-slate-300 dark:border-zinc-600",
            textColor: "text-slate-900 dark:text-slate-100",
          },
        ]
      : []),
    ...(propinas
      ? [
          {
            label: "Propinas",
            value: formatSoles(propinas),
            icon: Sparkles,
            color: "from-pink-600 to-pink-700",
            bg: "bg-pink-50 dark:bg-pink-950/40",
            border: "border-pink-300 dark:border-pink-700",
            textColor: "text-pink-900 dark:text-pink-100",
          },
        ]
      : []),
    {
      label: "Negocios Activos",
      value: String(negocio_count),
      icon: Store,
      color: "from-violet-600 to-violet-700",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      border: "border-violet-300 dark:border-violet-700",
      textColor: "text-violet-900 dark:text-violet-100",
    },
  ];

  const cols =
    cards.length <= 2 ? "grid-cols-2" :
    cards.length === 3 ? "grid-cols-3" :
    cards.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
    "grid-cols-2 sm:grid-cols-5";

  return (
    <div className={`grid ${cols} gap-3`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`rounded-xl border-2 p-4 ${card.bg} ${card.border} shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.textColor} leading-tight tabular-nums`}>
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
