"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";

export interface ChatbotPersonalization {
  tutorName: string;
  tone: "socratic" | "formal" | "friendly" | "motivating";
  teachingStyle: "concise" | "detailed" | "step-by-step" | "examples";
  customInstructions: string;
}

const DEFAULTS: ChatbotPersonalization = {
  tutorName: "Socrates",
  tone: "socratic",
  teachingStyle: "concise",
  customInstructions: "",
};

interface PersonalizationContextType {
  personalization: ChatbotPersonalization;
  loading: boolean;
  /** Call after saving new settings so all consumers update instantly */
  setPersonalization: (p: ChatbotPersonalization) => void;
}

const PersonalizationContext = createContext<
  PersonalizationContextType | undefined
>(undefined);

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [personalization, setPersonalization] =
    useState<ChatbotPersonalization>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/settings/chatbot?userId=${userId}`);
      const data = await res.json();
      if (data.personalization) {
        setPersonalization({ ...DEFAULTS, ...data.personalization });
      }
    } catch {
      // Non-fatal — stay on defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchSettings(user.id);
    } else if (!user) {
      setLoading(false);
    }
  }, [user?.id, fetchSettings]);

  return (
    <PersonalizationContext.Provider
      value={{ personalization, loading, setPersonalization }}>
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalization() {
  const ctx = useContext(PersonalizationContext);
  if (!ctx) {
    throw new Error(
      "usePersonalization must be used within a PersonalizationProvider",
    );
  }
  return ctx;
}
