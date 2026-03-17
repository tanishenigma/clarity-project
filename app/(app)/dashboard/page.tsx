"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Brain, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { StudyTimer } from "@/components/study-timer";
import { Skeleton } from "@/components/ui/skeleton";
import CalendarHeatmap, {
  CalendarHeatmapData,
} from "@/components/CalendarHeatmap";
import { subDays } from "date-fns";

interface DashboardData {
  stats: {
    studyStreak: number;
  };
  recentSpaces: Array<{
    _id: string;
    name: string;
    icon: string;
    progress: number;
  }>;
  recentQuizzes: Array<{
    _id: string;
    title: string;
    difficulty: string;
    questionCount: number;
  }>;
  activity: CalendarHeatmapData[];
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/dashboard?userId=${user.id}`);
        if (response.ok) {
          const dashboardData = await response.json();
          if (dashboardData.activity) {
            dashboardData.activity = dashboardData.activity.map((a: any) => ({
              ...a,
              date: new Date(a.date),
            }));
          }
          setData(dashboardData);
        }
      } catch (error) {
        console.error("Error fetching dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchDashboard();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        {/* Stats grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 col-span-full lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        {/* Recent Spaces */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
        {/* Recommended */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to Clarity
          </h1>
          <p className="text-muted-foreground mt-2">
            Sign in to track your learning progress
          </p>
        </div>
        <Card className="p-8 text-center">
          <Brain className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Get Started</h2>
          <p className="text-muted-foreground mb-4">
            Create an account to save your progress, create spaces, and track
            your learning journey.
          </p>
          <Link href="/auth">
            {" "}
            <Button>
              {" "}
              <LogIn className="w-4 h-4" />
              Sign In or Register
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const stats = data?.stats || {
    studyStreak: 0,
  };

  return (
    <div className="flex flex-col gap-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {" "}
          Hey There, {user.username?.replace(/^./, (c) => c.toUpperCase())}
        </h1>
        <p className="text-muted-foreground mt-2">
          Continue your learning journey
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Activity Heatmap */}
        <Card className="p-4 sm:p-6 col-span-full lg:col-span-2 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-lg font-medium text-foreground">
                Activity Overview
              </p>
            </div>
            <CalendarHeatmap data={data?.activity || []} />
          </div>
        </Card>

        {/* Study Timer Card */}
        <StudyTimer
          userId={user.id}
          variant="full"
          className="col-span-full lg:col-span-1"
        />
      </div>

      {/* Recent Spaces */}
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">My Spaces</h2>
          <Link href="/spaces">
            <Button variant="outline" size="sm">
              View all
            </Button>
          </Link>
        </div>

        {data?.recentSpaces && data.recentSpaces.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-5">
            {data.recentSpaces.map((space) => (
              <Link key={space._id} href={`/spaces/${space._id}`}>
                <Card className="p-4 sm:p-6 cursor-pointer hover:border-primary transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{space.icon}</div>
                    <p className="font-semibold text-foreground truncate">
                      {space.name}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No spaces yet. Create your first study space!
            </p>
            <Link href="/spaces">
              <Button>Create Space</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
