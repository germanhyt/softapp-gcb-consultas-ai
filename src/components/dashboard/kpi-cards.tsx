"use client";

import { TrendingUp, Target, BarChart2, Store, Sparkles } from "lucide-react";
import { formatSoles } from "@/lib/config/column-rules";

interface KpiCardsProps {
  total: number;
  presupuesto?: number;
  negocio_count: number;
  propinas?: number;
}

interface CardConfig {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  glowColor: string;
  bg: string;
  border: string;
}

export function KpiCards({ total, presupuesto, negocio_count, propinas }: KpiCardsProps) {
  const cumplimiento = presupuesto && presupuesto > 0 ? (total / presupuesto) * 100 : null;

  const cumplAccent =
    cumplimiento === null          ? "var(--neutral)"    :
    cumplimiento >= 100            ? "var(--primary)"    :
    cumplimiento >= 80             ? "#60a5fa"           :
    cumplimiento >= 60             ? "var(--secondary)"  :
                                     "var(--tertiary)";

  const cards: CardConfig[] = [
    {
      label: "Ventas Totales",
      value: formatSoles(total),
      icon: TrendingUp,
      accent: "var(--primary)",
      glowColor: "rgba(56,209,73,0.20)",
      bg: "rgba(56,209,73,0.07)",
      border: "rgba(56,209,73,0.20)",
    },
    ...(presupuesto
      ? [
          {
            label: "Presupuesto",
            value: formatSoles(presupuesto),
            icon: Target,
            accent: "#60a5fa",
            glowColor: "rgba(96,165,250,0.20)",
            bg: "rgba(96,165,250,0.07)",
            border: "rgba(96,165,250,0.20)",
          } satisfies CardConfig,
          {
            label: "Cumplimiento",
            value: cumplimiento !== null ? `${cumplimiento.toFixed(1)}%` : "—",
            icon: BarChart2,
            accent: cumplAccent,
            glowColor: "rgba(56,209,73,0.15)",
            bg: "rgba(255,255,255,0.03)",
            border: "var(--border-strong)",
          } satisfies CardConfig,
        ]
      : []),
    ...(propinas
      ? [
          {
            label: "Propinas",
            value: formatSoles(propinas),
            icon: Sparkles,
            accent: "var(--secondary)",
            glowColor: "rgba(255,159,67,0.20)",
            bg: "rgba(255,159,67,0.07)",
            border: "rgba(255,159,67,0.20)",
          } satisfies CardConfig,
        ]
      : []),
    {
      label: "Negocios Activos",
      value: String(negocio_count),
      icon: Store,
      accent: "#a78bfa",
      glowColor: "rgba(167,139,250,0.20)",
      bg: "rgba(167,139,250,0.07)",
      border: "rgba(167,139,250,0.20)",
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
          <div
            key={card.label}
            className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              boxShadow: `0 4px 20px ${card.glowColor}`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: `${card.accent}20`,
                  border: `1px solid ${card.accent}40`,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: card.accent }}
                />
              </div>
              <span
                className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--foreground-muted)" }}
              >
                {card.label}
              </span>
            </div>
            <p
              className="text-2xl sm:text-3xl font-bold leading-tight tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
