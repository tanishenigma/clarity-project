"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Target,
  BookMarked,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import CalendarHeatmap, {
  CalendarHeatmapData,
} from "@/components/CalendarHeatmap";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  isSameMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  studyStreak: number;
  totalStudyHours: number;
  topicsMastered: number;
  weeklyProgress: number[];
  subjectBreakdown: { subject: string; percentage: number; color: string }[];
  recentActivity: { date: string; minutes: number; score?: number }[];
  flashcardStats: {
    total: number;
    mastered: number;
    learning: number;
    due: number;
  };
  quizStats: {
    total: number;
    completed: number;
    avgScore: number;
  };
  recentAttempts?: Array<{
    quizTitle: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    completedAt: string;
    difficulty: string;
  }>;
  activity?: Array<{ date: Date | string; count: number }>;
  studyTimeActivity?: Array<{ date: string; minutes: number }>;
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/analytics?userId=${user.id}`);
      if (response.ok) {
        const analyticsData = await response.json();
        if (analyticsData.activity) {
          analyticsData.activity = analyticsData.activity.map((a: any) => ({
            ...a,
            date: new Date(a.date),
          }));
        }
        setData(analyticsData);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Refetch when the study timer is stopped so the calendar updates immediately
  useEffect(() => {
    const handler = () => fetchAnalytics();
    window.addEventListener("study-timer-stopped", handler);
    return () => window.removeEventListener("study-timer-stopped", handler);
  }, [fetchAnalytics]);

  if (authLoading || loading) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        {/* Heatmap */}
        <Skeleton className="h-36 rounded-2xl" />
        {/* Two-col grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        {/* Bottom grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Login Required
        </h1>
        <p className="text-muted-foreground mb-6">
          Please login to view your analytics
        </p>
        <Link href="/settings">
          <Button>Go to Login</Button>
        </Link>
      </div>
    );
  }

  // Default data if nothing from API
  const analytics = data || {
    studyStreak: 0,
    totalStudyHours: 0,
    topicsMastered: 0,
    weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
    subjectBreakdown: [],
    recentActivity: [],
    flashcardStats: { total: 0, mastered: 0, learning: 0, due: 0 },
    quizStats: { total: 0, completed: 0, avgScore: 0 },
    recentAttempts: [],
    activity: [],
    studyTimeActivity: [],
  };

  const maxWeeklyScore = Math.max(...analytics.weeklyProgress, 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const activityHeatmapData: CalendarHeatmapData[] = (
    analytics.activity || []
  ).map((a) => ({
    date: a.date instanceof Date ? a.date : new Date(a.date as string),
    count: a.count,
  }));

  const today = new Date();
  const isCurrentMonth = isSameMonth(viewMonth, today);
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Monday-first offset: Sun(0)→6, Mon(1)→0, …
  const leadingEmptyDays = (getDay(monthStart) + 6) % 7;

  const studyTimeMap = new Map<string, number>(
    (analytics.studyTimeActivity || []).map((a) => [a.date, a.minutes]),
  );

  const getStudyIntensityClass = (minutes: number): string => {
    if (minutes >= 480) return "bg-primary/80";
    if (minutes >= 360) return "bg-primary/50";
    if (minutes >= 240) return "bg-primary/30";
    if (minutes >= 60) return "bg-primary/20";
    if (minutes >= 30) return "bg-primary/10";
    return "bg-primary/5";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Study Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and identify areas for improvement
          </p>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          {
            label: "Study Streak",
            value: `${analytics.studyStreak} days`,
            icon: TrendingUp,
            color: "text-warning",
          },
          {
            label: "Quizzes Completed",
            value: analytics.quizStats.completed.toString(),
            icon: Brain,
            color: "text-primary",
          },
          {
            label: "Average Score",
            value: `${analytics.quizStats.avgScore}%`,
            icon: Target,
            color: "text-success",
          },
          {
            label: "Topics Mastered",
            value: analytics.topicsMastered.toString(),
            icon: BookMarked,
            color: "text-accent",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-3 md:p-5">
              <div className="flex items-center gap-2 md:gap-3">
                <div
                  className={`p-2 md:p-2.5 rounded-full bg-muted ${stat.color} shrink-0`}>
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] md:text-xs text-muted-foreground leading-tight">
                    {stat.label}
                  </p>
                  <p className="text-lg md:text-2xl font-bold text-foreground leading-tight">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Activity Heatmap — same as Dashboard */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Activity Overview
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your learning activity over the past year
            </p>
          </div>
          <div className="overflow-x-auto">
            <CalendarHeatmap data={activityHeatmapData} />
          </div>
        </div>
      </Card>

      {/* Study Time — monthly calendar + annual heatmap */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Monthly Study Calendar */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {format(viewMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setViewMonth((m) => startOfMonth(addMonths(m, -1)))
                }>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isCurrentMonth}
                onClick={() =>
                  setViewMonth((m) => startOfMonth(addMonths(m, 1)))
                }>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Daily study time this month
          </p>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingEmptyDays }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {monthDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const minutes = studyTimeMap.get(dateStr) || 0;
              const isTodayDay = dateStr === format(today, "yyyy-MM-dd");
              const isFuture = day > today;
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "flex flex-col items-center justify-start p-1 rounded-lg min-h-13",
                    isTodayDay ? "ring-1 ring-primary" : "",
                    isFuture
                      ? "opacity-30 bg-muted/40"
                      : minutes > 0
                        ? getStudyIntensityClass(minutes)
                        : "bg-muted/40",
                  )}>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isTodayDay ? "text-primary font-bold" : "text-foreground",
                    )}>
                    {format(day, "d")}
                  </span>
                  {minutes > 0 && !isFuture && (
                    <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">
                      {minutes}m
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[
              "bg-muted/40",
              "bg-primary/15",
              "bg-primary/30",
              "bg-primary/50",
              "bg-primary/80",
            ].map((cls, i) => (
              <div
                key={i}
                className={cn("rounded-sm", cls)}
                style={{ width: "12px", height: "12px" }}
              />
            ))}
            <span>More</span>
          </div>
        </Card>

        {/* Weekly Quiz Progress Chart */}
        <Card className="p-4 md:p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Weekly Quiz Scores
          </h2>
          {/* Chart area: fixed height for bars only */}
          <div className="flex items-end gap-1.5 h-full">
            {analytics.weeklyProgress.map((score, index) => (
              <div
                key={index}
                className="flex-1 flex flex-col justify-end h-full">
                <div
                  className={`h-full  transition-all ${
                    score >= 80
                      ? "bg-success"
                      : score >= 60
                        ? "bg-success/60"
                        : score >= 30
                          ? "bg-warning"
                          : score > 0
                            ? "bg-destructive"
                            : "bg-muted"
                  }`}
                  style={{
                    height:
                      score > 0
                        ? `${Math.max(4, (score / maxWeeklyScore) * 292)}px`
                        : "2px",
                  }}
                />
              </div>
            ))}
          </div>
          {/* Labels below the chart */}
          <div className="flex gap-1.5 mt-2">
            {days.map((day, i) => (
              <div key={day} className="flex-1 text-center">
                <p className="text-[11px] text-muted-foreground">{day}</p>
                <p className="text-[11px] font-medium text-foreground">
                  {analytics.weeklyProgress[i] > 0
                    ? `${analytics.weeklyProgress[i]}%`
                    : "-"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Flashcard Stats */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" />
            Flashcard Progress
          </h2>
          <div className="space-y-4">
            {[
              {
                label: "Total Cards",
                value: analytics.flashcardStats.total,
                color: "bg-primary",
              },
              {
                label: "Mastered",
                value: analytics.flashcardStats.mastered,
                color: "bg-success",
              },
              {
                label: "Learning",
                value: analytics.flashcardStats.learning,
                color: "bg-warning",
              },
              {
                label: "Due Today",
                value: analytics.flashcardStats.due,
                color: "bg-destructive",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                  <span className="text-muted-foreground">{stat.label}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
          <Link href="/study/flashcards">
            <Button className="w-full mt-6 rounded-full">
              Review Due Cards
            </Button>
          </Link>
        </Card>

        {/* Quiz Stats */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Quiz Performance
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Quizzes</span>
              <span className="font-semibold text-foreground">
                {analytics.quizStats.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold text-foreground">
                {analytics.quizStats.completed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average Score</span>
              <span className="font-semibold text-foreground">
                {analytics.quizStats.avgScore}%
              </span>
            </div>

            {/* Score Gauge */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Performance</span>
                <span>{analytics.quizStats.avgScore}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    analytics.quizStats.avgScore >= 80
                      ? "bg-success"
                      : analytics.quizStats.avgScore >= 60
                        ? "bg-success/60"
                        : analytics.quizStats.avgScore >= 30
                          ? "bg-warning"
                          : analytics.quizStats.avgScore > 0
                            ? "bg-destructive"
                            : "bg-muted"
                  }`}
                  style={{ width: `${analytics.quizStats.avgScore}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Subject Breakdown - Now shows topic performance from quizzes */}
      {(analytics.subjectBreakdown.length > 0 ||
        analytics.quizStats.completed > 0) && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Topic Performance
          </h2>
          <div className="space-y-4">
            {analytics.subjectBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Complete quizzes to see your topic performance breakdown.
              </p>
            )}
            {analytics.subjectBreakdown.map((subject) => (
              <div key={subject.subject}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-foreground">{subject.subject}</span>
                  <span className="text-muted-foreground">
                    {subject.percentage}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      subject.percentage >= 80
                        ? "bg-success"
                        : subject.percentage >= 60
                          ? "bg-success/60"
                          : subject.percentage >= 30
                            ? "bg-warning"
                            : subject.percentage > 0
                              ? "bg-destructive"
                              : "bg-muted"
                    }`}
                    style={{
                      width: `${subject.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
