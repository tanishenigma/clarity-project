"use client";

import * as React from "react";
import {
  format,
  subYears,
  eachDayOfInterval,
  startOfDay,
  startOfWeek,
  addDays,
} from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CalendarHeatmapData {
  date: Date;
  count: number;
}

interface CalendarHeatmapProps {
  data: CalendarHeatmapData[];
  totalLabel?: string;
}

const COLORS = {
  zero: "bg-muted",
  one: "bg-primary/20",
  two: "bg-primary/40",
  three: "bg-primary/70",
  four: "bg-primary",
};

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export default function CalendarHeatmap({
  data,
  totalLabel = " activities",
}: CalendarHeatmapProps) {
  const today = startOfDay(new Date());
  const rangeStart = startOfWeek(subYears(today, 1), { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: rangeStart, end: today });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const countMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of data) {
      map.set(format(entry.date, "yyyy-MM-dd"), entry.count);
    }
    return map;
  }, [data]);

  const getCount = (day: Date) => countMap.get(format(day, "yyyy-MM-dd")) ?? 0;

  const getIntensity = (count: number) => {
    if (count === 0) return COLORS.zero;
    if (count <= 2) return COLORS.one;
    if (count <= 6) return COLORS.two;
    if (count <= 12) return COLORS.three;
    return COLORS.four;
  };

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  const monthLabels: { colIndex: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, ci) => {
    const firstDay = week.find((d) => d <= today);
    if (!firstDay) return;
    const m = firstDay.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ colIndex: ci, label: format(firstDay, "MMM") });
      lastMonth = m;
    }
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      // Scrolls to the end of the container on mount
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="inline-flex flex-col gap-3 font-mono select-none w-full ">
        {/* Header */}
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-foreground font-semibold">
            {totalCount.toLocaleString()}
            <span className="text-muted-foreground">
              {`${totalLabel} in the last year`}
            </span>
          </span>
        </div>
        <div
          ref={scrollRef}
          className="overflow-x-auto scroll-smooth no-scrollbar">
          <div className="flex gap-2">
            {/* Day-of-week labels */}
            <div className="flex flex-col pt-5" style={{ gap: "2px" }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-[10px] text-muted-foreground leading-none flex items-center"
                  style={{ height: "16px" }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div className="flex flex-col">
              {/* Month labels row */}
              <div className="flex mb-1" style={{ gap: "2px" }}>
                {weeks.map((_, ci) => {
                  const label = monthLabels.find((m) => m.colIndex === ci);
                  return (
                    <div
                      key={ci}
                      className="text-[10px] text-muted-foreground leading-none"
                      style={{ width: "16px", minWidth: "16px" }}>
                      {label?.label ?? ""}
                    </div>
                  );
                })}
              </div>

              {/* Cell grid: 7 rows × N columns */}
              <div
                className="grid"
                style={{
                  gridTemplateRows: "repeat(7, 16px)",
                  gridTemplateColumns: `repeat(${weeks.length}, 16px)`,
                  gridAutoFlow: "column",
                  gap: "2px",
                }}>
                {weeks.map((weekDays, ci) =>
                  weekDays.map((day, ri) => {
                    const count = getCount(day);
                    const intensity = getIntensity(count);
                    const isFuture = day > today;
                    const dateStr = format(day, "MMM d, yyyy");

                    return (
                      <Tooltip key={`${ci}-${ri}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "rounded-[2px] cursor-default transition-opacity duration-150",
                              isFuture
                                ? "opacity-0 pointer-events-none"
                                : intensity,
                              !isFuture &&
                                "hover:ring-1 hover:ring-foreground/30",
                            )}
                            style={{ width: "14px", height: "14px" }}
                          />
                        </TooltipTrigger>
                        {!isFuture && (
                          <TooltipContent
                            side="top"
                            className="text-xs px-2 py-1 rounded-md shadow-lg">
                            <span className="font-semibold text-primary">
                              {count}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              {totalLabel} on{" "}
                            </span>
                            <span>{dateStr}</span>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 self-start text-[10px] text-muted-foreground">
          <span>Less</span>
          {[COLORS.zero, COLORS.one, COLORS.two, COLORS.three, COLORS.four].map(
            (cls, i) => (
              <div
                key={i}
                className={cn("rounded-[2px]", cls)}
                style={{ width: "14px", height: "14px" }}
              />
            ),
          )}
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
