import type { Types } from "mongoose";
type ObjectId = Types.ObjectId;

export interface User {
  _id?: ObjectId;
  email: string;
  username: string;
  passwordHash: string;
  authProvider: "email" | "google" | "github";
  createdAt: Date;
  theme: "light" | "dark";
  subscriptionTier: "free" | "pro" | "premium";
  studyStreak: number;
  totalStudyMinutes: number;
  apiSettings?: APISettings;
}

export interface APISettings {
  primaryProvider: "gemini" | "openai" | "euri" | "groq" | "custom";
  apiKeys: {
    gemini?: string;
    openai?: string;
    euri?: string;
    groq?: string;
    custom?: {
      name: string;
      apiKey: string;
      endpoint: string;
    };
  };
  fallbackEnabled: boolean;
  fallbackProvider?: "gemini" | "openai" | "euri" | "groq";
  updatedAt: Date;
}

export interface Space {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description: string;
  icon: string;
  subject: string;
  examTarget: string;
  coverImage?: string;
  isPublic: boolean;
  collaborators: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Content {
  _id?: ObjectId;
  spaceId: ObjectId;
  userId: ObjectId;
  type: "pdf" | "image" | "audio" | "video" | "text" | "link" | "handwritten";
  title: string;
  description: string;
  source: {
    url?: string;
    fileKey: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
  };
  processed?: {
    rawText?: string;
    transcript?: string;
    ocr?: string;
    chunks: Array<{
      id: string;
      text: string;
      chunkIndex: number;
      vectorId: string;
    }>;
    metadata: {
      extractedTopics: string[];
      difficulty: "beginner" | "intermediate" | "advanced";
      language: string;
      pageCount?: number;
      duration?: number;
    };
    processedAt: Date;
  };
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processingError?: string;
}

export interface Flashcard {
  _id?: ObjectId;
  contentId: ObjectId;
  spaceId: ObjectId;
  userId: ObjectId;
  type: "normal" | "activeRecall";
  question: string;
  answer: string;
  tags: string[];
  difficulty: number;
  generatedAt: Date;
  reviewStats: {
    totalReviews: number;
    correctCount: number;
    lastReviewedAt?: Date;
    nextReviewAt?: Date;
  };
}

export interface Quiz {
  _id?: ObjectId;
  contentId: ObjectId;
  spaceId: ObjectId;
  userId: ObjectId;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  questions: Array<{
    _id?: ObjectId;
    text: string;
    type: "mcq" | "subjective" | "truefalse";
    options?: string[];
    correctAnswer: string;
    explanation: string;
    tags: string[];
    difficulty: number;
  }>;
  timeLimit?: number;
  createdAt: Date;
  attempts: Array<{
    userId: ObjectId;
    startedAt: Date;
    completedAt?: Date;
    score: number;
    answers: Record<string, string>;
    analytics: {
      timeSpent: number;
      questionsSkipped: number;
      correctPerTopic: Record<string, number>;
    };
  }>;
}

export interface Summary {
  _id?: ObjectId;
  contentId: ObjectId;
  spaceId: ObjectId;
  type: "quick" | "detailed" | "examFocused";
  title: string;
  chapterBreakdown: Array<{
    chapter: number;
    title: string;
    keyPoints: string[];
    summary: string;
    keyTerms: Record<string, string>;
  }>;
  generatedAt: Date;
}

// Learning Space Types (for AI Tutor Agent Workflow)
export interface LearningSpace {
  _id?: ObjectId;
  userId: ObjectId | string;
  topic: string;
  pdfSource?: string | null;
  summaryNotes?: {
    title: string;
    summary: string;
  };
  quiz?: {
    title: string;
    questions: Array<{
      question: string;
      options: { A: string; B: string; C: string; D: string };
      correctAnswer: "A" | "B" | "C" | "D";
      hint: string;
      explaination: string;
    }>;
  };
  recommendations?: {
    recommendations: Array<{
      title: string;
      description: string;
      url: string | null;
    }>;
  };
  mindmap?: {
    nodes: Array<{ id: string; label: string; fillcolor?: string }>;
    edges: Array<{ source: string; target: string; label?: string | null }>;
    centralNode: string;
  };
  audioScript?: string;
  audioOverview?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile {
  _id?: ObjectId;
  userId: ObjectId | string;
  gender: string;
  gradeLevel: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}
