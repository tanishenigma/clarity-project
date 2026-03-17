"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookMarked,
  Plus,
  Trash2,
  Loader2,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Flashcard } from "./types";
import { LatexRenderer } from "@/components/ui/latex-renderer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import TiltedCard from "../TiltedCard";

interface FlashcardsTabProps {
  flashcards: Flashcard[];
  spaceId: string;
  userId: string;
  hasContent: boolean;
  onRefresh: () => void;
  onStudyModeChange?: (active: boolean) => void;
}

export function FlashcardsTab({
  flashcards,
  spaceId,
  userId,
  hasContent,
  onRefresh,
  onStudyModeChange,
}: FlashcardsTabProps) {
  // Study Mode State
  const [studyDeck, setStudyDeck] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStudying, setIsStudying] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });

  // UI State (Zen Mode & Track Progress)
  const [isZenMode, setIsZenMode] = useState(false);
  const [trackProgress, setTrackProgress] = useState(true);

  // Creation State
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);

  // Generation State
  const [showGenerate, setShowGenerate] = useState(false);
  const [numCards, setNumCards] = useState(10);
  const [genDifficulty, setGenDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [generating, setGenerating] = useState(false);

  // --- Effects ---

  // Keyboard Shortcuts for Study Mode
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isStudying || studyComplete) return;
      // Prevent interfering with text inputs / textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        setShowAnswer((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (showAnswer) handleAnswer(true);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (showAnswer) handleAnswer(false);
      }
    },
    [isStudying, studyComplete, showAnswer],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle Syncing React State with Browser Fullscreen State
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsZenMode(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
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

  // --- Study Logic ---

  const resetStudySession = () => {
    // Exit fullscreen if active when quitting
    if (isZenMode) {
      document.exitFullscreen().catch(console.error);
    }
    setIsStudying(false);
    onStudyModeChange?.(false);
    setStudyComplete(false);
    setCurrentIndex(0);
    setShowAnswer(false);
    setStats({ correct: 0, incorrect: 0 });
  };

  const startStudy = (deck: Flashcard[]) => {
    setStudyDeck(deck);
    setCurrentIndex(0);
    setStudyComplete(false);
    setStats({ correct: 0, incorrect: 0 });
    setIsStudying(true);
    onStudyModeChange?.(true);
    setShowAnswer(false);
    setShowCreate(false);
  };

  const handleShuffle = () => {
    const shuffled = [...flashcards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    startStudy(shuffled);
  };

  const handleNormalStudy = (startIndex: number) => {
    setStudyDeck(flashcards);
    setCurrentIndex(startIndex);
    setStudyComplete(false);
    setStats({ correct: 0, incorrect: 0 });
    setIsStudying(true);
    onStudyModeChange?.(true);
    setShowAnswer(false);
  };

  const handleAnswer = (correct: boolean) => {
    const card = studyDeck[currentIndex];

    // Update local stats
    setStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));

    // Persist review stats for analytics (fire-and-forget)
    fetch("/api/flashcards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId: card._id, correct }),
    }).catch(() => {});

    // Move to next card
    if (currentIndex < studyDeck.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      setStudyComplete(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  // --- CRUD Logic ---

  const handleCreate = async () => {
    if (!question.trim() || !answer.trim()) return;
    setCreating(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          tags: tagList,
          spaceId,
          userId,
        }),
      });

      if (response.ok) {
        onRefresh();
        setQuestion("");
        setAnswer("");
        setTags("");
        setShowCreate(false);
      }
    } catch (error) {
      console.error("Error creating flashcard:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/flashcards?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) onRefresh();
    } catch (error) {
      console.error("Error deleting flashcard:", error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          userId,
          numCards,
          difficulty: genDifficulty,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        onRefresh();
        setShowGenerate(false);
        toast.success(
          `Generated ${data.inserted} flashcard${data.inserted !== 1 ? "s" : ""}!`,
        );
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to generate flashcards");
      }
    } catch (error) {
      console.error("Error generating flashcards:", error);
      toast.error("Error generating flashcards");
    } finally {
      setGenerating(false);
    }
  };

  // --- Views ---

  // 1. Session Complete View
  if (isStudying && studyComplete) {
    const totalCards = studyDeck.length;
    const percentage =
      totalCards > 0 ? Math.round((stats.correct / totalCards) * 100) : 0;
    const termsLeft = 0;

    // SVG donut chart params
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const knowOffset =
      circumference - (stats.correct / totalCards) * circumference;
    const learningOffset =
      circumference - (stats.incorrect / totalCards) * circumference;

    return (
      <div className="max-w-md mx-auto space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={resetStudySession}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            Session Complete!
          </h2>
          <Button
            size="sm"
            onClick={() => startStudy(studyDeck)}
            variant="outline">
            <RotateCcw className="w-4 h-4 mr-1" /> Again
          </Button>
        </div>

        <Card className="p-6">
          <h3 className="text-xl font-bold text-foreground mb-6">
            How you&apos;re doing
          </h3>

          <div className="flex items-center gap-6">
            {/* Donut chart */}
            <div className="relative shrink-0">
              <svg width="140" height="140" viewBox="0 0 140 140">
                {/* background track */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="12"
                />
                {/* incorrect arc (renders first, behind) */}
                {stats.incorrect > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#7c4a2e"
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={learningOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                )}
                {/* correct arc */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={knowOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-foreground">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Stats rows */}
            <div className="flex-1 space-y-2">
              {/* Know */}
              <div
                className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "hsl(var(--primary))" }}>
                  Know
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "hsl(var(--primary))" }}>
                  {stats.correct}
                </span>
              </div>
              {/* Still learning */}
              <div
                className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ backgroundColor: "rgba(124,74,46,0.25)" }}>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "#c4855a" }}>
                  Still learning
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "#c4855a" }}>
                  {stats.incorrect}
                </span>
              </div>
              {/* Terms left */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted">
                <span className="text-sm font-semibold text-muted-foreground">
                  Terms left
                </span>
                <span className="text-sm font-bold text-muted-foreground">
                  {termsLeft}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Active Study View
  if (isStudying) {
    const currentCard = studyDeck[currentIndex];

    const containerClasses = isZenMode
      ? "fixed inset-0 z-[9999] bg-background p-8 overflow-y-auto flex flex-col animate-in fade-in duration-200"
      : "max-w-2xl mx-auto space-y-6";

    const contentWrapperClasses = isZenMode
      ? "w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center gap-6"
      : "space-y-6";

    return (
      <div className={containerClasses}>
        <div className={contentWrapperClasses}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={resetStudySession}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Flashcard Study
                </h1>
                <p className="text-sm text-muted-foreground">
                  {studyDeck.length === flashcards.length
                    ? "All Cards"
                    : "Custom Session"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Track Progress toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Track progress
                </span>
                <button
                  onClick={() => setTrackProgress((p) => !p)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    trackProgress ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                  title="Toggle progress tracking">
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      trackProgress ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
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
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-lg font-bold text-foreground">
                  {currentIndex + 1}/{studyDeck.length}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${((currentIndex + 1) / studyDeck.length) * 100}%`,
              }}
            />
          </div>
          <TiltedCard
            containerHeight="380px"
            containerWidth="100%"
            scaleOnHover={1.02}
            rotateAmplitude={8}
            showMobileWarning={false}
            showTooltip={false}>
            {/* 3D Flip Card */}
            <div
              className="w-full h-full cursor-pointer select-none"
              style={{ perspective: 1000 }}
              onClick={() => setShowAnswer(!showAnswer)}>
              <div
                className="relative w-full transition-transform duration-500"
                style={{
                  height: 380,
                  transformStyle: "preserve-3d",
                  transform: showAnswer ? "rotateY(180deg)" : "rotateY(0deg)",
                }}>
                {/* FRONT */}
                <div
                  className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 pt-10 pb-10 shadow-md"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                  }}>
                  {currentCard.tags?.[0] && (
                    <span className="absolute top-4 left-4 text-xs text-muted-foreground">
                      {currentCard.tags[0]}
                    </span>
                  )}
                  {currentCard.tags?.[1] && (
                    <span className="absolute top-4 right-4 text-xs text-muted-foreground">
                      {currentCard.tags[1]}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground absolute bottom-4 left-4">
                    Card {currentIndex + 1}
                  </p>
                  <span className="text-xs text-muted-foreground absolute bottom-4 right-4">
                    space to flip
                  </span>
                  <div className="overflow-y-auto max-h-70 w-full flex items-center justify-center scrollbar-thin">
                    <p className="text-sm sm:text-base md:text-xl font-bold text-foreground text-center leading-relaxed">
                      <LatexRenderer>{currentCard.question}</LatexRenderer>
                    </p>
                  </div>
                </div>

                {/* BACK */}
                <div
                  className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 pt-10 pb-10 shadow-md"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    backgroundColor: "var(--primary)",
                  }}>
                  {currentCard.tags?.[0] && (
                    <span className="absolute top-4 left-4 text-xs text-primary-foreground/60">
                      {currentCard.tags[0]}
                    </span>
                  )}
                  {currentCard.tags?.[1] && (
                    <span className="absolute top-4 right-4 text-xs text-primary-foreground/60">
                      {currentCard.tags[1]}
                    </span>
                  )}
                  <span className="text-xs text-primary-foreground/60 absolute bottom-4 right-4">
                    tap to flip back
                  </span>
                  <div className="overflow-y-auto max-h-70 w-full flex items-center justify-center scrollbar-thin">
                    <p className="text-sm sm:text-base md:text-xl font-bold text-primary-foreground text-center leading-relaxed">
                      <LatexRenderer>{currentCard.answer}</LatexRenderer>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TiltedCard>

          {/* Answer actions — only shown when flipped */}
          {showAnswer ? (
            <div className="flex items-center gap-3 justify-center">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={currentIndex === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 max-w-45 border-destructive/50 hover:bg-destructive/10"
                onClick={() => handleAnswer(false)}>
                <X className="w-4 h-4 mr-2 text-destructive" />
                <span>Needs Work</span>
                <kbd className="ml-2 hidden sm:inline-flex items-center rounded border border-muted-foreground/30 px-1 text-[10px] text-muted-foreground">
                  ←
                </kbd>
              </Button>
              <Button
                size="lg"
                className="flex-1 max-w-45"
                onClick={() => handleAnswer(true)}>
                <Check className="w-4 h-4 mr-2" />
                <span>Got It</span>
                <kbd className="ml-2 hidden sm:inline-flex items-center rounded border border-primary-foreground/30 px-1 text-[10px] text-primary-foreground/70">
                  →
                </kbd>
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                disabled={currentIndex === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button onClick={() => setShowAnswer(true)}>Show Answer</Button>
              <Button
                variant="outline"
                disabled={currentIndex === studyDeck.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentIndex < studyDeck.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setShowAnswer(false);
                  }
                }}>
                Skip
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Stats footer */}
          {trackProgress && (
            <div className="flex justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">
                  Know: {stats.correct}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground">
                  Still learning: {stats.incorrect}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  Left: {studyDeck.length - currentIndex - 1}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Default Management View (Grid)
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {flashcards.length > 1 && (
            <Button variant="outline" onClick={handleShuffle} className="gap-2">
              <Shuffle className="w-4 h-4" /> Shuffle Study
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowGenerate(true);
              setShowCreate(false);
            }}
            className="gap-2"
            disabled={!hasContent || showGenerate}>
            <Sparkles className="w-4 h-4" /> Generate
          </Button>
          <Button
            onClick={() => {
              setShowCreate(true);
              setShowGenerate(false);
            }}
            className="gap-2">
            <Plus className="w-4 h-4" /> Create Flashcard
          </Button>
        </div>
      </div>

      {showGenerate && (
        <Card className="p-6 border-primary/20">
          <h3 className="text-lg font-semibold mb-4">
            Generate Flashcards from Content
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Difficulty
              </label>
              <div className="flex gap-2 mt-2">
                {(["easy", "medium", "hard"] as const).map((level) => (
                  <Button
                    key={level}
                    variant={genDifficulty === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGenDifficulty(level)}
                    className="capitalize">
                    {level}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Number of Flashcards
              </label>
              <div className="flex gap-2 mt-2">
                {[5, 10, 15, 20].map((num) => (
                  <Button
                    key={num}
                    variant={numCards === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNumCards(num)}>
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
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Generating...
                  </>
                ) : (
                  "Generate Flashcards"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showCreate && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Flashcard</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Question
              </label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Question..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Answer
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer..."
                className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm min-h-25"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Tags
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., math, algebra"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !question || !answer}>
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {flashcards.length === 0 && !showCreate && !showGenerate ? (
        <Card className="p-8 text-center border-dashed">
          <BookMarked className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            {!hasContent
              ? "Upload content first to generate flashcards, or create them manually!"
              : "No flashcards yet. Generate from your content or create manually!"}
          </p>
          <div className="flex gap-2 justify-center">
            {hasContent && (
              <Button
                variant="outline"
                onClick={() => setShowGenerate(true)}
                className="gap-2">
                <Sparkles className="w-4 h-4" /> Generate
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)}>
              Create Flashcard
            </Button>
          </div>
        </Card>
      ) : flashcards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-4">
          {flashcards.map((card, index) => (
            <Card
              key={card._id}
              className="p-4 hover:border-primary relative group transition-all">
              <div
                className="cursor-pointer"
                onClick={() => handleNormalStudy(index)}>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Card {index + 1}
                </p>
                <p className="font-semibold text-foreground mb-4 line-clamp-2">
                  <LatexRenderer>{card.question}</LatexRenderer>
                </p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(card._id)}>
                <Trash2 className="w-3 h-3" />{" "}
              </Button>

              {/* <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Flashcard</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(card._id)}
                      className="bg-destructive hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog> */}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
