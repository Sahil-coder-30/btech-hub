"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number; note?: string };

type Props = {
  data: BarDatum[];
  max?: number;
  height?: number;
  title: string;
  valueFormat?: (v: number) => string;
  className?: string;
};

/**
 * Single series bar chart in plain SVG. Follows the dataviz rules: one hue
 * (validated #7c3aed light / #8b5cf6 dark), 4px rounded data ends on the baseline,
 * 2px gaps, recessive grid, hover tooltip, value labels only on hover/focus.
 */
export function BarChart({ data, max, height = 220, title, valueFormat = (v) => v.toFixed(2), className }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(10, ...data.map((d) => d.value));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t * 10) / 10);

  const W = 600;
  const H = height;
  const pad = { l: 32, r: 8, t: 12, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(44, slot - 2);

  return (
    <figure className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${valueFormat(d.value)}`).join(", ")}`}>
        {ticks.map((t) => {
          const y = pad.t + plotH - (t / top) * plotH;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="stroke-border" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {t}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const h = Math.max(0, (d.value / top) * plotH);
          const x = pad.l + i * slot + (slot - barW) / 2;
          const y = pad.t + plotH - h;
          const r = Math.min(4, h / 2, barW / 2);
          // Path with rounded top corners only, anchored flat on the baseline
          const path = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`;
          return (
            <g
              key={d.label + i}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-default outline-none"
            >
              {/* Hit target taller and wider than the mark */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={plotH} fill="transparent" />
              {h > 0 && <path d={path} className={cn("fill-[#7c3aed] transition-opacity dark:fill-[#8b5cf6]", active !== null && active !== i && "opacity-40")} />}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {d.label}
              </text>
              {active === i && (
                <text x={x + barW / 2} y={Math.max(pad.t + 10, y - 6)} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">
                  {valueFormat(d.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active !== null && data[active]?.note && (
        <figcaption className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
          <span className="font-semibold">{data[active].label}</span>: {valueFormat(data[active].value)}
          <div className="text-muted-foreground">{data[active].note}</div>
        </figcaption>
      )}
    </figure>
  );
}
