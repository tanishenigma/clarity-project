import {
  FileText,
  BookMarked,
  BarChart3,
  MessageCircle,
  GitBranch,
  BookOpen,
  LucideIcon,
} from "lucide-react";

interface SpaceTabsNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  stats: {
    contentCount: number;
    flashcardCount: number;
    quizCount: number;
  };
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  tab: string;
  value?: number;
}

const buildNavItems = (stats: SpaceTabsNavProps["stats"]): NavItem[] => [
  {
    label: "Content Items",
    value: stats.contentCount,
    icon: FileText,
    tab: "content",
  },
  {
    label: "Flashcards",
    value: stats.flashcardCount,
    icon: BookMarked,
    tab: "flashcards",
  },
  {
    label: "Quizzes",
    value: stats.quizCount,
    icon: BarChart3,
    tab: "quizzes",
  },
  {
    label: "Mindmap",
    icon: GitBranch,
    tab: "mindmap",
  },
  {
    label: "Summary",
    icon: BookOpen,
    tab: "summary",
  },
  {
    label: "Study Chat",
    icon: MessageCircle,
    tab: "chat",
  },
];

export function SpaceTabsNav({
  activeTab,
  onTabChange,
  stats,
}: SpaceTabsNavProps) {
  return (
    <div className="sticky top-0 z-50 pt-2 px-1 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {buildNavItems(stats).map((item) => {
          const isSelected = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className={`
                flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 transition-all duration-200 text-sm font-medium border
                ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground/70 border-border hover:text-foreground hover:bg-muted"
                }
              `}>
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.value !== undefined && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                  {item.value}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
