"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GraphExpression {
  id: string;
  latex: string;
  color?: string;
  hidden?: boolean;
}

interface GraphViewport {
  xmin: number;
  xmax: number;
  ymin?: number;
  ymax?: number;
}

interface GraphAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface GraphUpdate {
  expressions: GraphExpression[];
  viewport?: GraphViewport;
  annotations?: GraphAnnotation[];
}

interface GraphViewerProps {
  graphData: GraphUpdate;
  className?: string;
}

declare global {
  interface Window {
    Desmos: any;
  }
}

export function GraphViewer({ graphData, className }: GraphViewerProps) {
  const calculatorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Load Desmos script
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.Desmos) {
      // Already loaded from a previous GraphViewer instance
      setScriptLoaded(true);
      return;
    }

    // Check if the script tag is already in the DOM (in-flight load)
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="desmos.com/api"]',
    );

    if (existingScript) {
      // Another instance already kicked off the load — wait for it
      const onLoad = () => setScriptLoaded(true);
      const onError = () => setLoadError(true);
      existingScript.addEventListener("load", onLoad);
      existingScript.addEventListener("error", onError);
      return () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
      };
    }

    // First mount — inject the script tag
    const script = document.createElement("script");
    script.src =
      "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Desmos script");
      setLoadError(true);
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize calculator
  useEffect(() => {
    if (scriptLoaded && containerRef.current && !calculatorRef.current) {
      try {
        calculatorRef.current = window.Desmos.GraphingCalculator(
          containerRef.current,
          {
            keypad: false,
            expressions: false,
            settingsMenu: false,
            zoomButtons: true,
            invertedColors: isDark,
            branding: false,
          },
        );
        setIsLoading(false);
        // graphData may have already arrived before the calculator was ready.
        // The update effect will re-run now because scriptLoaded is in its dep array.
      } catch (error) {
        console.error("Failed to initialize Desmos:", error);
        setIsLoading(false);
      }
    }
  }, [scriptLoaded]);

  // Sync Desmos theme with app theme
  useEffect(() => {
    if (calculatorRef.current) {
      calculatorRef.current.updateSettings({ invertedColors: isDark });
    }
  }, [isDark]);

  // Update graph when data changes
  useEffect(() => {
    if (!calculatorRef.current || !graphData) return;

    try {
      // Clear existing expressions
      calculatorRef.current.setBlank();

      // Add curve/function expressions
      graphData.expressions?.forEach((expr) => {
        calculatorRef.current.setExpression({
          id: expr.id,
          latex: expr.latex,
          color: expr.color || "#c74440",
          hidden: expr.hidden || false,
        });
      });

      // Set viewport if specified
      if (graphData.viewport) {
        calculatorRef.current.setMathBounds({
          left: graphData.viewport.xmin,
          right: graphData.viewport.xmax,
          bottom: graphData.viewport.ymin ?? graphData.viewport.xmin,
          top: graphData.viewport.ymax ?? graphData.viewport.xmax,
        });
      }

      // Add annotations as labeled points — use a prefix to avoid ID collisions
      // with curve expressions that may use the same IDs.
      graphData.annotations?.forEach((ann) => {
        calculatorRef.current.setExpression({
          id: `ann_${ann.id}`,
          latex: `(${ann.x}, ${ann.y})`,
          showLabel: true,
          label: ann.text,
          color: "#ffffff",
          pointSize: 9,
          labelSize: window.Desmos?.LabelSize?.MEDIUM ?? 1,
          labelOrientation: window.Desmos?.LabelOrientations?.ABOVE ?? "above",
        });
      });
    } catch (error) {
      console.error("Failed to update graph:", error);
    }
    // Re-run whenever graphData changes OR the calculator finishes initialising.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, scriptLoaded]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const resetView = () => {
    if (calculatorRef.current) {
      if (graphData.viewport) {
        calculatorRef.current.setMathBounds({
          left: graphData.viewport.xmin,
          right: graphData.viewport.xmax,
          bottom: graphData.viewport.ymin ?? graphData.viewport.xmin,
          top: graphData.viewport.ymax ?? graphData.viewport.xmax,
        });
      } else {
        calculatorRef.current.setDefaultState();
      }
    }
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isExpanded ? "fixed inset-4 z-50" : "w-full max-w-2xl mx-auto h-100",
        className,
      )}>
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 p-0"
          onClick={resetView}
          title="Reset view">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 p-0"
          onClick={toggleExpand}
          title={isExpanded ? "Minimize" : "Maximize"}>
          {isExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="text-sm text-muted-foreground">Loading graph...</div>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="text-sm text-destructive text-center px-4">
            Failed to load the graph renderer. Please check your connection and
            reload.
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </Card>
  );
}
