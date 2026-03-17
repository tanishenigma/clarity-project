"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/timer-utils";

// ── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "study-timer-session";

interface PersistedSession {
  sessionId: string;
  /** Unix ms timestamp of when the session started */
  startTime: number;
  /** todayTotal at the moment of start (completed sessions only) */
  todayTotal: number;
}

function readPersisted(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

function writePersisted(p: PersistedSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

interface StudyTimerProps {
  userId: string;
  variant?: "compact" | "full" | "collapsed";
  className?: string;
}

export function StudyTimer({
  userId,
  variant = "full",
  className,
}: StudyTimerProps) {
  // Initialise state synchronously from localStorage — zero flash of "0:00" on reload
  const [isRunning, setIsRunning] = useState<boolean>(
    () => readPersisted() !== null,
  );

  const [elapsed, setElapsed] = useState<number>(() => {
    const p = readPersisted();
    if (!p) return 0;
    return Math.max(0, Math.floor((Date.now() - p.startTime) / 1000));
  });

  const [todayTotal, setTodayTotal] = useState<number>(() => {
    return readPersisted()?.todayTotal ?? 0;
  });

  const [sessionId, setSessionId] = useState<string | null>(() => {
    return readPersisted()?.sessionId ?? null;
  });

  // Stable refs so async callbacks always see latest values
  const elapsedRef = useRef(elapsed);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Fetch authoritative state from server once on mount — corrects any drift
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/study-timer/status?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.isActive && data.sessionId) {
        const serverElapsed: number = data.currentDuration || 0;
        // Reconstruct startTime so localStorage stays accurate
        const startTime = Date.now() - serverElapsed * 1000;

        setIsRunning(true);
        setSessionId(data.sessionId);
        setElapsed(serverElapsed);
        setTodayTotal(data.todayTotal || 0);
        writePersisted({
          sessionId: data.sessionId,
          startTime,
          todayTotal: data.todayTotal || 0,
        });
      } else {
        // No active session on the server — clear everything
        setIsRunning(false);
        setSessionId(null);
        setElapsed(0);
        setTodayTotal(data.todayTotal || 0);
        clearPersisted();
      }
    } catch (err) {
      console.error("Failed to fetch timer status:", err);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Sync elapsed time to DB every 30 seconds while running
  useEffect(() => {
    if (!isRunning) return;

    const syncInterval = setInterval(async () => {
      const currentSessionId = sessionIdRef.current;
      const currentElapsed = elapsedRef.current;
      if (!currentSessionId) return;
      try {
        await fetch("/api/study-timer/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            sessionId: currentSessionId,
            currentDuration: currentElapsed,
          }),
        });
      } catch (error) {
        console.error("Failed to sync timer:", error);
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [isRunning, userId]);

  // Update elapsed time every second
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = async () => {
    if (isRunning) return;
    try {
      const res = await fetch("/api/study-timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) return;

      // Fresh start returns { sessionId, startTime }
      // Already-active returns { message, session: { _id, startTime } }
      const resolvedId: string | null =
        data.sessionId ??
        (data.session?._id != null ? String(data.session._id) : null);

      const resolvedStartTime: number = data.startTime
        ? new Date(data.startTime).getTime()
        : data.session?.startTime
          ? new Date(data.session.startTime).getTime()
          : Date.now();

      if (resolvedId) {
        const serverElapsed = Math.max(
          0,
          Math.floor((Date.now() - resolvedStartTime) / 1000),
        );
        setSessionId(resolvedId);
        setIsRunning(true);
        setElapsed(serverElapsed);
        writePersisted({
          sessionId: resolvedId,
          startTime: resolvedStartTime,
          todayTotal,
        });
      }
    } catch (err) {
      console.error("Failed to start timer:", err);
    }
  };
  const handleStop = async () => {
    if (!isRunning || !sessionId) return;
    try {
      const res = await fetch("/api/study-timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        const finalDuration = data.duration ?? elapsed;
        setTodayTotal((prev) => prev + finalDuration);
        setIsRunning(false);
        setSessionId(null);
        setElapsed(0);
        clearPersisted();
        // Notify any listening pages (e.g. analytics) to refetch updated data
        window.dispatchEvent(new CustomEvent("study-timer-stopped"));
      }
    } catch (err) {
      console.error("Failed to stop timer:", err);
    }
  };

  const totalDisplay = (todayTotal || 0) + (isRunning ? elapsed : 0);

  if (variant === "collapsed") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center cursor-pointer",
          className,
        )}
        onClick={isRunning ? handleStop : handleStart}
        title={isRunning ? "Stop timer" : "Start timer"}>
        <Clock
          className={cn(
            "w-5 h-5 mb-1",
            isRunning ? "text-success" : "text-[#292929]",
          )}
        />
        <span className="text-[10px] font-mono text-muted-foreground">
          {formatDuration(totalDisplay)}
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          size="sm"
          variant={isRunning ? "destructive" : "default"}
          onClick={isRunning ? handleStop : handleStart}
          className="h-8">
          {isRunning ? (
            <>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-3 w-3 mr-1" />
              Start
            </>
          )}
        </Button>
        <span className="text-sm font-mono text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(totalDisplay)}
        </span>
      </div>
    );
  }

  return (
    <Card className={cn("p-4 sm:p-6", className)}>
      <div className="space-y-3 sm:space-y-4">
        <h3 className="text-lg font-semibold">Study Timer</h3>

        {/* Current Session Time */}
        <div className="text-center">
          <div
            className={cn(
              "text-3xl sm:text-4xl font-mono font-bold",
              isRunning ? "text-primary" : "text-muted-foreground",
            )}>
            {formatDuration(elapsed)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Current Session</p>
        </div>

        {/* Today's Total */}
        <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
          <div className="text-xl sm:text-2xl font-mono font-semibold">
            {formatDuration(totalDisplay)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Today's Total (Resets at 5:30 AM)
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              className="flex-1 h-10 sm:h-12"
              size="lg">
              <Play className="h-5 w-5 mr-2" />
              Start Studying
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              variant="destructive"
              className="flex-1 h-10 sm:h-12"
              size="lg">
              <Square className="h-5 w-5 mr-2" />
              Stop Session
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
