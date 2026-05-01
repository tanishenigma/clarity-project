"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, Brain, ArrowLeft, Lock, LogIn } from "lucide-react"; // Added Lock
import { useAuth } from "@/lib/auth-context"; // Added auth hook

export default function StudyPage() {
  const { user } = useAuth();

  // Login Conditional
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Card className="w-full max-w-md p-8 text-center shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="bg-muted p-4 rounded-full">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Login Required
          </h2>
          <p className="text-muted-foreground mb-8">
            Please log in to access your study center and track progress.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth" className="w-full">
              <Button className="w-full">
                {" "}
                <LogIn className="w-4 h-4" />
                Sign In or Register
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Original Content
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Study Center</h1>
          <p className="text-muted-foreground mt-1">Choose your study mode</p>
        </div>
      </div>

      {/* Study Options */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/study/flashcards">
          <Card className="p-6 hover:border-primary transition-colors cursor-pointer h-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BookMarked className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Flashcards
              </h2>
              <p className="text-muted-foreground">
                Review your flashcards using spaced repetition to maximize
                retention
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/spaces">
          <Card className="p-6 hover:border-primary transition-colors cursor-pointer h-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Quizzes
              </h2>
              <p className="text-muted-foreground">
                Test your knowledge with AI-generated quizzes from your spaces
              </p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Quick Start
        </h2>
        <div className="flex flex-wrap gap-4">
          <Link href="/study/flashcards">
            <Button>Review Due Flashcards</Button>
          </Link>
          <Link href="/spaces">
            <Button variant="outline">Browse Spaces</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
