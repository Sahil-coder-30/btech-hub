import type { ActivityDay } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

const level = (count: number) => (count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4);

const LEVELS = [
  "bg-[var(--surface-3)]",
  "bg-[color-mix(in_oklab,#8B5CF6_30%,var(--surface-3))]",
  "bg-[color-mix(in_oklab,#8B5CF6_55%,var(--surface-3))]",
  "bg-[color-mix(in_oklab,#8B5CF6_78%,var(--surface-3))]",
  "bg-[#8B5CF6]",
];

const label = (d: ActivityDay) =>
  `${new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}: ${d.count ? `${d.count} ${d.count === 1 ? "activity" : "activities"}` : "no activity"}`;

/** GitHub style grid of the last 12 weeks. A column is a week, Monday on top. */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  // Pad the start so the first column begins on a Monday
  const firstWeekday = (new Date(`${days[0]?.date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (ActivityDay | null)[] = [...Array<null>(firstWeekday).fill(null), ...days];
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] pt-0 text-[9px] leading-none text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="flex h-full items-center">
              {d}
            </span>
          ))}
        </div>
        <div className="grid flex-1 auto-cols-fr grid-flow-col gap-[3px]" role="img" aria-label={`Study activity for the last ${days.length} days`}>
          {weeks.map((week, w) => (
            <div key={w} className="grid grid-rows-7 gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => week[i] ?? null).map((d, i) =>
                d ? <span key={d.date} title={label(d)} className={cn("aspect-square w-full rounded-[3px]", LEVELS[level(d.count)])} /> : <span key={`pad-${i}`} className="aspect-square w-full" />,
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground" aria-hidden>
        Less
        {LEVELS.map((c) => (
          <span key={c} className={cn("size-2.5 rounded-[3px]", c)} />
        ))}
        More
      </div>
    </div>
  );
}
