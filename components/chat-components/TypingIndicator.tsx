import { MessageCircle, BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TypingIndicatorProps {
  isGeneratingGraph?: boolean;
}

export function TypingIndicator({ isGeneratingGraph }: TypingIndicatorProps) {
  return (
    <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 flex-shrink-0 shadow-md">
        {isGeneratingGraph ? (
          <BarChart2 className="h-4 w-4 text-primary-foreground" />
        ) : (
          <MessageCircle className="h-4 w-4 text-primary-foreground" />
        )}
      </div>
      <Card className="p-4 bg-card border-border/50">
        {isGeneratingGraph ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
            <div
              className="h-2 w-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="h-2 w-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
            <span className="text-xs text-muted-foreground ml-1">
              Generating graph…
            </span>
          </div>
        ) : (
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
            <div
              className="h-2 w-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="h-2 w-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
