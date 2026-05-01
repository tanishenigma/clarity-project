// Frontend-facing (string-ID) types for space-related data.
// These are the shapes returned by the API and consumed by UI components.

export interface Space {
  _id: string;
  name: string;
  subject: string;
  examTarget: string;
  icon: string;
  description: string;
  stats: {
    contentCount: number;
    flashcardCount: number;
    quizCount: number;
  };
}

export interface ContentItem {
  _id: string;
  title: string;
  type: "text" | "image" | "pdf" | "audio" | "video";
  source: {
    url: string;
    fileKey: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  };
  createdAt: string;
}

export interface Flashcard {
  _id: string;
  question: string;
  answer: string;
  tags: string[];
  reviewStats: { totalReviews: number; correctCount: number };
}

export interface Quiz {
  _id: string;
  title: string;
  difficulty: string;
  questions: Array<any>;
  completedAt?: string | null;
  lastScore?: number | null;
  attemptCount?: number;
}

export interface SpaceData {
  space: {
    _id: string;
    name: string;
    icon: string;
    subject: string;
    examTarget: string;
    description: string;
  };
  content: ContentItem[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  stats: {
    contentCount: number;
    flashcardCount: number;
    quizCount: number;
    totalStudyMinutes: number;
  };
}
