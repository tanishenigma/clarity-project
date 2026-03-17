"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackLogProps {
  feedbackLog: string[];
  className?: string;
}

export function FeedbackLog({ feedbackLog, className }: FeedbackLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!feedbackLog || feedbackLog.length === 0) {
    return null;
  }

  const getLineType = (line: string) => {
    if (line.includes("ITERATION")) return "iteration";
    if (line.includes("MATH AGENT")) return "math";
    if (line.includes("ANALYZER")) return "analyzer";
    if (line.includes("FEEDBACK")) return "feedback";
    if (line.includes("satisfied") || line.includes("✓")) return "success";
    if (line.includes("⚠")) return "warning";
    if (line.includes("USER")) return "user";
    return "default";
  };

  const getLineColor = (type: string) => {
    switch (type) {
      case "iteration":
        return "text-primary font-semibold";
      case "math":
        return "text-accent";
      case "analyzer":
        return "text-success";
      case "feedback":
        return "text-warning";
      case "success":
        return "text-success font-medium";
      case "warning":
        return "text-warning";
      case "user":
        return "text-foreground font-medium";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card
      className={cn("overflow-hidden border-l-4 border-l-primary ", className)}>
      <Button
        variant="subtle"
        size="sm"
        className="w-full justify-between p-3"
        onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Agent Feedback Loop</span>
          <span className="text-xs text-muted-foreground">
            ({feedbackLog.filter((l) => l.includes("ITERATION")).length}{" "}
            iterations)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-4 space-y-1 max-h-[400px] overflow-y-auto">
          {feedbackLog.map((line, index) => {
            const type = getLineType(line);
            const color = getLineColor(type);

            if (!line.trim()) {
              return <div key={index} className="h-2" />;
            }

            return (
              <div
                key={index}
                className={cn(
                  "text-xs font-mono leading-relaxed",
                  color,
                  type === "iteration" && "mt-3 pt-2 border-t",
                )}>
                {line}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
