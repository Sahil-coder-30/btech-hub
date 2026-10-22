"use client";

import { useState, type CSSProperties } from "react";
import type { SgpaRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const TICKS = [10, 7.5, 5, 2.5, 0];

/**
 * SGPA bars for all 8 semesters. Done semesters are filled, upcoming ones are dashed,
 * and dashed lines mark the CGPA and the target CGPA.
 */
export function SgpaChart({ records, cgpa, target }: { records: Pick<SgpaRecord, "semester" | "sgpa" | "total_credits" | "source">[]; cgpa: number; target: number | null }) {
  const bySem = new Map(records.map((r) => [r.semester, r]));
  const [active, setActive] = useState<number | null>(null);
  const best = Math.max(...records.map((r) => Number(r.sgpa)));

  return (
    <figure className="m-0">
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
        <div className="flex h-52 flex-col justify-between pb-0 text-right font-mono text-[10px] text-muted-foreground" aria-hidden>
          {TICKS.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>

        <div className="relative h-52 border-b border-border-strong bg-[linear-gradient(var(--border)_1px,transparent_1px)] bg-[length:100%_25%]">
          {cgpa > 0 && <Guide value={cgpa} label={`CGPA ${cgpa.toFixed(2)}`} className="border-primary/60 text-primary" />}
          {target && <Guide value={target} label={`Target ${target}`} className="border-success/70 text-success" right />}

          <ol className="absolute inset-0 flex items-end gap-1.5 px-1 sm:gap-3 sm:px-2">
            {SEMESTERS.map((sem) => {
              const r = bySem.get(sem);
              const value = r ? Number(r.sgpa) : 0;
              const isActive = active === sem;
              return (
                <li key={sem} className="relative flex h-full flex-1 flex-col items-center justify-end">
                  {r ? (
                    <button
                      type="button"
                      onMouseEnter={() => setActive(sem)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(sem)}
                      onBlur={() => setActive(null)}
                      aria-label={`Semester ${sem}: SGPA ${value.toFixed(2)}`}
                      className={cn(
                        "w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#6D4AFF] to-[#A78BFA] transition-[filter,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active !== null && !isActive && "opacity-45",
                        value === best && records.length > 1 && "from-[#0EA371] to-[#34D399]",
                      )}
                      style={{ height: `${Math.max(4, value * 10)}%` }}
                    />
                  ) : (
                    <span className="h-[18%] w-full max-w-12 rounded-t-lg border border-dashed border-border-strong/80" aria-hidden />
                  )}

                  {r && isActive && (
                    <span role="tooltip" className="pointer-events-none absolute bottom-[calc(var(--h)+8px)] z-10 whitespace-nowrap rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg" style={{ "--h": `${value * 10}%` } as CSSProperties}>
                      <span className="font-mono font-semibold">{value.toFixed(2)}</span> · {Number(r.total_credits)} cr · {r.source === "aktu_result" ? "AKTU result" : "estimate"}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <ol className="ml-[36px] mt-2 flex gap-1.5 px-1 sm:gap-3 sm:px-2" aria-hidden>
        {SEMESTERS.map((sem) => (
          <li key={sem} className={cn("flex-1 text-center font-mono text-[11px]", bySem.has(sem) ? "text-foreground" : "text-muted-foreground/70")}>
            S{sem}
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">
        SGPA by semester: {records.map((r) => `semester ${r.semester} ${Number(r.sgpa).toFixed(2)}`).join(", ")}.
      </figcaption>
    </figure>
  );
}

/** Horizontal dashed line at a value on the 0 to 10 scale. */
function Guide({ value, label, className, right }: { value: number; label: string; className?: string; right?: boolean }) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed", className)} style={{ bottom: `${Math.min(100, value * 10)}%` }} aria-hidden>
      <span className={cn("absolute -top-5 rounded-md bg-card/90 px-1.5 font-mono text-[10px] font-semibold", right ? "right-1" : "left-1")}>{label}</span>
    </div>
  );
}
