"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  BookMarked,
  RotateCcw,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { LatexRenderer } from "@/components/ui/latex-renderer";
import TiltedCard from "@/components/TiltedCard";

interface Flashcard {
  _id: string;
  question: string;
  answer: string;
  tags: string[];
  spaceId: string;
  spaceName?: string;
}

export default function FlashcardsStudyPage() {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [trackProgress, setTrackProgress] = useState(true);
  const [filter, setFilter] = useState<"all" | "due">("due");

  const fetchFlashcards = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const url = `/api/flashcards?userId=${user.id}${filter === "due" ? "&dueOnly=true" : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data);
        setCurrentIndex(0);
        setStudyComplete(false);
        setStats({ correct: 0, incorrect: 0 });
        setShowAnswer(false);
      }
    } catch (e) {
      console.error("Error fetching flashcards:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => { fetchFlashcards(); }, [fetchFlashcards]);

  const handleAnswer = useCallback(
    (correct: boolean) => {
      const card = flashcards[currentIndex];
      setStats((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        incorrect: prev.incorrect + (correct ? 0 : 1),
      }));
      fetch("/api/flashcards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcardId: card._id, correct }),
      }).catch(() => {});
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        setStudyComplete(true);
      }
    },
    [flashcards, currentIndex],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (studyComplete || flashcards.length === 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); setShowAnswer((p) => !p); }
      else if (e.code === "ArrowRight") { e.preventDefault(); if (showAnswer) handleAnswer(true); }
      else if (e.code === "ArrowLeft")  { e.preventDefault(); if (showAnswer) handleAnswer(false); }
    },
    [studyComplete, flashcards.length, showAnswer, handleAnswer],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handlePrevious = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setShowAnswer(false); }
  };

  const resetStudy = () => {
    setCurrentIndex(0); setShowAnswer(false);
    setStudyComplete(false); setStats({ correct: 0, incorrect: 0 });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <BookMarked className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Login Required</h1>
        <p className="text-muted-foreground mb-6">Please login to study your flashcards</p>
        <Link href="/auth"><Button>Log in</Button></Link>
      </div>
    );
  }

  // ── Session Complete ─────────────────────────────────────────────────────
  if (studyComplete) {
    const total = flashcards.length;
    const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const knowOffset    = circumference - (stats.correct   / total) * circumference;
    const learningOffset = circumference - (stats.incorrect / total) * circumference;

    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h2 className="text-lg font-semibold text-foreground">Session Complete!</h2>
          <Button size="sm" onClick={resetStudy} variant="outline">
            <RotateCcw className="w-4 h-4 mr-1" /> Again
          </Button>
        </div>

        <Card className="p-6">
          <h3 className="text-xl font-bold text-foreground mb-6">How you&apos;re doing</h3>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="12" />
                {stats.incorrect > 0 && (
                  <circle cx="70" cy="70" r={radius} fill="none" stroke="#7c4a2e" strokeWidth="12"
                    strokeDasharray={circumference} strokeDashoffset={learningOffset}
                    strokeLinecap="round" transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                )}
                <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--primary)" strokeWidth="12"
                  strokeDasharray={circumference} strokeDashoffset={knowOffset}
                  strokeLinecap="round" transform="rotate(-90 70 70)"
                  style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{percentage}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}>
                <span className="text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>Know</span>
                <span className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>{stats.correct}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ backgroundColor: "rgba(124,74,46,0.25)" }}>
                <span className="text-sm font-semibold" style={{ color: "#c4855a" }}>Still learning</span>
                <span className="text-sm font-bold" style={{ color: "#c4855a" }}>{stats.incorrect}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted">
                <span className="text-sm font-semibold text-muted-foreground">Terms left</span>
                <span className="text-sm font-bold text-muted-foreground">0</span>
              </div>
            </div>
          </div>
          <button
            className="mt-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setStudyComplete(false); setCurrentIndex(flashcards.length - 1); setShowAnswer(true); }}>
            <ArrowLeft className="w-4 h-4" /> Back to last question
          </button>
        </Card>
      </div>
    );
  }

  // ── No Cards ─────────────────────────────────────────────────────────────
  if (flashcards.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-foreground">Flashcard Study</h1>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "due" ? "default" : "outline"} onClick={() => setFilter("due")}>Due for Review</Button>
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All Cards</Button>
        </div>
        <Card className="p-8 text-center border-dashed">
          <BookMarked className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {filter === "due" ? "No Cards Due" : "No Flashcards Yet"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {filter === "due"
              ? "You've reviewed all due flashcards. Great job!"
              : "Create flashcards inside any Space to start studying."}
          </p>
          <div className="flex gap-4 justify-center">
            {filter === "due" && (
              <Button variant="outline" onClick={() => setFilter("all")}>Study All Cards</Button>
            )}
            <Link href="/spaces"><Button>Go to Spaces</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  // ── Active Study ─────────────────────────────────────────────────────────
  const currentCard = flashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Flashcard Study</h1>
            <p className="text-sm text-muted-foreground">
              {filter === "due" ? "Due for Review" : "All Cards"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-1">
            <Button size="sm" variant={filter === "due" ? "default" : "ghost"} onClick={() => setFilter("due")}>Due</Button>
            <Button size="sm" variant={filter === "all" ? "default" : "ghost"} onClick={() => setFilter("all")}>All</Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">Track progress</span>
            <button
              onClick={() => setTrackProgress((p) => !p)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                trackProgress ? "bg-primary" : "bg-muted-foreground/30"
              }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                trackProgress ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="text-lg font-bold text-foreground">{currentIndex + 1}/{flashcards.length}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }} />
      </div>

      {/* 3-D flip card */}
      <TiltedCard containerHeight="380px" containerWidth="100%" scaleOnHover={1.02}
        rotateAmplitude={8} showMobileWarning={false} showTooltip={false}>
        <div className="w-full h-full cursor-pointer select-none" style={{ perspective: 1000 }}
          onClick={() => setShowAnswer((p) => !p)}>
          <div className="relative w-full transition-transform duration-500"
            style={{ height: 380, transformStyle: "preserve-3d",
              transform: showAnswer ? "rotateY(180deg)" : "rotateY(0deg)" }}>

            {/* FRONT */}
            <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 pt-10 pb-10 shadow-md"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              {currentCard.spaceName && (
                <span className="absolute top-4 left-4 text-xs text-muted-foreground uppercase tracking-wide">
                  {currentCard.spaceName}
                </span>
              )}
              {currentCard.tags?.[0] && (
                <span className="absolute top-4 right-4 text-xs text-muted-foreground">{currentCard.tags[0]}</span>
              )}
              <p className="text-xs text-muted-foreground absolute bottom-4 left-4">Card {currentIndex + 1}</p>
              <span className="text-xs text-muted-foreground absolute bottom-4 right-4">space to flip</span>
              <div className="overflow-y-auto max-h-70 w-full flex items-center justify-center scrollbar-thin">
                <p className="text-sm sm:text-base md:text-xl font-bold text-foreground text-center leading-relaxed">
                  <LatexRenderer>{currentCard.question}</LatexRenderer>
                </p>
              </div>
            </div>

            {/* BACK */}
            <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 pt-10 pb-10 shadow-md"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)", backgroundColor: "var(--primary)" }}>
              {currentCard.spaceName && (
                <span className="absolute top-4 left-4 text-xs text-primary-foreground/60 uppercase tracking-wide">
                  {currentCard.spaceName}
                </span>
              )}
              {currentCard.tags?.[0] && (
                <span className="absolute top-4 right-4 text-xs text-primary-foreground/60">{currentCard.tags[0]}</span>
              )}
              <span className="text-xs text-primary-foreground/60 absolute bottom-4 right-4">space to flip back</span>
              <div className="overflow-y-auto max-h-70 w-full flex items-center justify-center scrollbar-thin">
                <p className="text-sm sm:text-base md:text-xl font-bold text-primary-foreground text-center leading-relaxed">
                  <LatexRenderer>{currentCard.answer}</LatexRenderer>
                </p>
              </div>
            </div>
          </div>
        </div>
      </TiltedCard>

      {/* Answer actions */}
      {showAnswer ? (
        <div className="flex items-center gap-3 justify-center">
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0"
            disabled={currentIndex === 0}
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="lg"
            className="flex-1 max-w-45 border-destructive/50 hover:bg-destructive/10"
            onClick={() => handleAnswer(false)}>
            <X className="w-4 h-4 mr-2 text-destructive" />
            <span>Needs Work</span>
            <kbd className="ml-2 hidden sm:inline-flex items-center rounded border border-muted-foreground/30 px-1 text-[10px] text-muted-foreground">←</kbd>
          </Button>
          <Button size="lg" className="flex-1 max-w-45" onClick={() => handleAnswer(true)}>
            <Check className="w-4 h-4 mr-2" />
            <span>Got It</span>
            <kbd className="ml-2 hidden sm:inline-flex items-center rounded border border-primary-foreground/30 px-1 text-[10px] text-primary-foreground/70">→</kbd>
          </Button>
        </div>
      ) : (
        <div className="flex gap-3 justify-center">
          <Button variant="outline" disabled={currentIndex === 0}
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>
          <Button onClick={() => setShowAnswer(true)}>Show Answer</Button>
        </div>
      )}

      {/* Stats footer */}
      {trackProgress && (
        <div className="flex justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Know: {stats.correct}</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-destructive" />
            <span className="text-muted-foreground">Still learning: {stats.incorrect}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Left: {flashcards.length - currentIndex - 1}</span>
          </div>
        </div>
      )}
    </div>
  );
}
