"use client";

import { useState, useEffect, use } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Trophy,
  Clock,
  Target,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LatexRenderer } from "@/components/ui/latex-renderer";

interface Question {
  text: string;
  question?: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
}

interface Quiz {
  _id: string;
  title: string;
  difficulty: string;
  questions: Question[];
  spaceId: string;
  spaceName?: string;
}

export default function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const [isZenMode, setIsZenMode] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsZenMode(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleZenMode = async () => {
    try {
      if (!isZenMode) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`/api/quizzes/${id}`);
        if (response.ok) {
          const data = await response.json();
          setQuiz(data);
          setAnswers(new Array(data.questions.length).fill(null));
        }
      } catch (error) {
        console.error("Error fetching quiz:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedAnswer;
    setAnswers(newAnswers);
    setShowResult(true);
  };

  const handleNextQuestion = async () => {
    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);

      // Submit quiz attempt
      const score = answers.filter((a, i) => {
        const q = quiz?.questions[i];
        if (!q) return false;
        const ci =
          typeof q.correctAnswer === "number"
            ? q.correctAnswer
            : q.options.indexOf(q.correctAnswer as unknown as string);
        return a === ci;
      }).length;

      try {
        if (user?.id) {
          await fetch(`/api/learning/quizzes/${id}/attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              score,
              totalQuestions: quiz?.questions.length,
              answers,
              durationMinutes: Math.round((Date.now() - startTime) / 60000),
            }),
          });

          // Mark quiz as completed and save score
          const percentage = Math.round(
            (score / (quiz?.questions.length || 1)) * 100,
          );
          await fetch(`/api/quizzes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: percentage }),
          });
        }
      } catch (error) {
        console.error("Error submitting quiz attempt:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quiz not found</p>
        <Link href="/spaces">
          <Button className="mt-4">Back to Spaces</Button>
        </Link>
      </div>
    );
  }

  if (quizComplete) {
    const correctAnswers = answers.filter((a, i) => {
      const q = quiz.questions[i];
      const ci =
        typeof q.correctAnswer === "number"
          ? q.correctAnswer
          : q.options.indexOf(q.correctAnswer as unknown as string);
      return a === ci;
    }).length;
    const percentage = Math.round(
      (correctAnswers / quiz.questions.length) * 100,
    );
    const duration = Math.round((Date.now() - startTime) / 60000);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-8 text-center">
          <Trophy
            className={`w-16 h-16 mx-auto mb-4 ${
              percentage >= 70 ? "text-warning" : "text-muted-foreground"
            }`}
          />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Quiz Complete!
          </h1>
          <p className="text-muted-foreground mb-6">{quiz.title}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-muted rounded-lg">
              <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-foreground">
                {percentage}%
              </p>
              <p className="text-sm text-muted-foreground">Score</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Check className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-2xl font-bold text-foreground">
                {correctAnswers}/{quiz.questions.length}
              </p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-foreground">{duration}m</p>
              <p className="text-sm text-muted-foreground">Time</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button
              onClick={() => {
                setCurrentQuestion(0);
                setSelectedAnswer(null);
                setShowResult(false);
                setAnswers(new Array(quiz.questions.length).fill(null));
                setQuizComplete(false);
              }}>
              Retry Quiz
            </Button>
          </div>
        </Card>

        {/* Review Answers */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Review Answers
          </h2>
          <div className="space-y-4">
            {quiz.questions.map((q, i) => {
              const ci =
                typeof q.correctAnswer === "number"
                  ? q.correctAnswer
                  : q.options.indexOf(q.correctAnswer as unknown as string);
              const isCorrect = answers[i] === ci;
              return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border ${
                    isCorrect
                      ? "border-success/50 bg-success/10"
                      : "border-destructive/50 bg-destructive/10"
                  }`}>
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <Check className="w-5 h-5 text-success mt-1" />
                    ) : (
                      <X className="w-5 h-5 text-destructive mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-2">
                        <LatexRenderer>{q.question ?? ""}</LatexRenderer>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your answer:{" "}
                        <LatexRenderer>
                          {q.options[answers[i] || 0] ?? ""}
                        </LatexRenderer>
                      </p>
                      {!isCorrect && (
                        <p className="text-sm text-success">
                          Correct:{" "}
                          <LatexRenderer>{q.options[ci] ?? ""}</LatexRenderer>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          <LatexRenderer>{q.explanation}</LatexRenderer>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];

  // Support both legacy string correctAnswer (option text) and new numeric index
  const resolveCorrectIndex = (q: Question): number => {
    if (typeof q.correctAnswer === "number") return q.correctAnswer;
    const idx = q.options.indexOf(q.correctAnswer as unknown as string);
    return idx !== -1 ? idx : 0;
  };

  const correctIndex = resolveCorrectIndex(question);
  const isCorrect = selectedAnswer === correctIndex;
  return (
    <div
      className={
        isZenMode
          ? "fixed inset-0 z-9999 bg-background p-8 overflow-y-auto flex flex-col animate-in fade-in duration-200"
          : "max-w-2xl mx-auto space-y-6"
      }>
      <div
        className={
          isZenMode
            ? "w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center gap-6"
            : "space-y-6"
        }>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {quiz.title}
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {quiz.difficulty} difficulty
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Question</p>
              <p className="text-lg font-bold text-foreground">
                {currentQuestion + 1}/{quiz.questions.length}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleZenMode}
              title={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}>
              {isZenMode ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%`,
            }}
          />
        </div>

        {/* Question */}
        <Card className="p-6">
          <p className="text-lg font-medium text-foreground mb-6">
            <LatexRenderer>{question.text}</LatexRenderer>
          </p>

          <div className="space-y-3">
            {question.options.map((option, index) => {
              let optionClass = "border-border hover:border-primary";

              if (showResult) {
                if (index === correctIndex) {
                  optionClass = "border-success bg-success/10";
                } else if (index === selectedAnswer && !isCorrect) {
                  optionClass = "border-destructive bg-destructive/10";
                }
              } else if (selectedAnswer === index) {
                optionClass = "border-primary bg-primary/10";
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                  className={`w-full p-4 text-left rounded-lg border transition-all ${optionClass}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-foreground">
                      <LatexRenderer>{option}</LatexRenderer>
                    </span>
                    {showResult && index === correctIndex && (
                      <Check className="w-5 h-5 text-success ml-auto" />
                    )}
                    {showResult && index === selectedAnswer && !isCorrect && (
                      <X className="w-5 h-5 text-destructive ml-auto" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {showResult && question.explanation && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground mb-1">
                Explanation
              </p>
              <p className="text-sm text-muted-foreground">
                <LatexRenderer>{question.explanation ?? ""}</LatexRenderer>
              </p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          {!showResult ? (
            <Button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null}>
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNextQuestion}>
              {currentQuestion < quiz.questions.length - 1
                ? "Next Question"
                : "Finish Quiz"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
