"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Quiz } from "./types";

const DIFFICULTY_LEVELS = ["easy", "medium", "hard"] as const;
const QUESTION_COUNTS = [5, 10, 15, 20] as const;

const getDifficultyColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "easy":
      return "bg-success/10 text-success";
    case "medium":
      return "bg-warning/10 text-warning";
    case "hard":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-primary/10 text-primary";
  }
};

interface QuizzesTabProps {
  quizzes: Quiz[];
  spaceId: string;
  userId: string;
  hasContent: boolean;
  onRefresh: () => void;
}

interface QuizCardProps {
  quiz: Quiz;
  isCompleted: boolean;
  isDeleting: boolean;
  onDelete: (quizId: string) => void;
}

function QuizCard({ quiz, isCompleted, isDeleting, onDelete }: QuizCardProps) {
  return (
    <Card
      className={`p-6 flex flex-col justify-between ${isCompleted ? "border-success/20" : ""}`}>
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3
            className="font-semibold text-foreground truncate pr-4"
            title={quiz.title}>
            {quiz.title}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(quiz._id)}
            disabled={isDeleting}
            className="text-muted-foreground hover:text-destructive h-8 w-8 -mt-1 -mr-2">
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <span
            className={`text-xs px-2 py-1 rounded capitalize font-medium ${getDifficultyColor(quiz.difficulty)}`}>
            {quiz.difficulty}
          </span>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
            {quiz.questions?.length || 0} questions
          </span>
          {isCompleted && quiz.lastScore != null && (
            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {quiz.lastScore}%
              {quiz.attemptCount && quiz.attemptCount > 1
                ? ` · ${quiz.attemptCount} attempts`
                : ""}
            </span>
          )}
        </div>
      </div>
      <Link href={`/study/quiz/${quiz._id}`} className="w-full">
        <Button
          className="w-full"
          variant={isCompleted ? "outline" : "secondary"}>
          {isCompleted ? (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake Quiz
            </>
          ) : (
            "Start Quiz"
          )}
        </Button>
      </Link>
    </Card>
  );
}

export function QuizzesTab({
  quizzes,
  spaceId,
  userId,
  hasContent,
  onRefresh,
}: QuizzesTabProps) {
  const router = useRouter();
  const [showGenerate, setShowGenerate] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [numQuestions, setNumQuestions] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const pendingQuizzes = quizzes.filter((q) => !q.completedAt);
  const completedQuizzes = quizzes.filter((q) => !!q.completedAt);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId, userId, difficulty, numQuestions }),
      });

      if (response.ok) {
        onRefresh();
        setShowGenerate(false);
        toast.success("Quiz generated successfully!");
      } else {
        toast.error("Failed to generate quiz");
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Error generating quiz");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this quiz? This cannot be undone.",
      )
    ) {
      return;
    }
    setIsDeleting(quizId);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete quiz");
      toast.success("Quiz deleted successfully");
      onRefresh();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowGenerate(true)}
          className="gap-2"
          disabled={!hasContent || showGenerate}>
          <Plus className="w-4 h-4" /> Generate Quiz
        </Button>
      </div>

      {showGenerate && (
        <Card className="p-6 border-primary/20">
          <h3 className="text-lg font-semibold mb-4">
            Generate Quiz from Content
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Difficulty
              </label>
              <div className="flex gap-2 mt-2">
                {DIFFICULTY_LEVELS.map((level) => (
                  <Button
                    key={level}
                    variant={difficulty === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficulty(level)}
                    className="capitalize">
                    {level}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Questions
              </label>
              <div className="flex gap-2 mt-2">
                {QUESTION_COUNTS.map((num) => (
                  <Button
                    key={num}
                    variant={numQuestions === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNumQuestions(num)}>
                    {num}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowGenerate(false)}
                disabled={generating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Quiz"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Available quizzes */}
      {pendingQuizzes.length === 0 &&
      !showGenerate &&
      completedQuizzes.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            {!hasContent
              ? "Upload content first to generate quizzes!"
              : "No quizzes yet. Generate your first quiz!"}
          </p>
        </Card>
      ) : (
        <>
          {pendingQuizzes.length > 0 && (
            <div className="space-y-3">
              {completedQuizzes.length > 0 && (
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Available
                </h4>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {pendingQuizzes.map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    isCompleted={false}
                    isDeleting={isDeleting === quiz._id}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {completedQuizzes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Completed
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                {completedQuizzes.map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    isCompleted
                    isDeleting={isDeleting === quiz._id}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
