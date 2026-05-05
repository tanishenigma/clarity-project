import { useEffect, useState } from "react";
import { usePersonalization } from "@/lib/personalization-context";
import {
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Youtube,
  Loader2,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Message } from "./types";
import type { Citation } from "./types";

const FLASHCARD_PROMPT_PREFIX =
  "I can generate flashcards for this study space.";
const QUIZ_PROMPT_PREFIX = "I can generate a quiz for this study space.";

type StudyPromptIntent = "flashcards" | "quiz";
type StudyPromptDifficulty = "easy" | "medium" | "hard";

interface StudyPromptConfig {
  intent: StudyPromptIntent;
  count: number | null;
  difficulty: StudyPromptDifficulty | null;
}

function parseStudyPrompt(content: string): StudyPromptConfig | null {
  const intent = content.startsWith(FLASHCARD_PROMPT_PREFIX)
    ? "flashcards"
    : content.startsWith(QUIZ_PROMPT_PREFIX)
      ? "quiz"
      : null;

  if (!intent) return null;

  const countMatch = content.match(/count set to\s+(\d+)/i);
  const difficultyMatch = content.match(
    /difficulty set to\s+(easy|medium|hard)/i,
  );

  return {
    intent,
    count: countMatch ? Number.parseInt(countMatch[1], 10) : null,
    difficulty:
      (difficultyMatch?.[1]?.toLowerCase() as StudyPromptDifficulty) ?? null,
  };
}

function StudyPromptCard({
  prompt,
  canInteract,
  onSubmit,
}: {
  prompt: StudyPromptConfig;
  canInteract: boolean;
  onSubmit?: (reply: string) => void;
}) {
  const [selectedCount, setSelectedCount] = useState<number | null>(
    prompt.count,
  );
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<StudyPromptDifficulty | null>(prompt.difficulty);

  useEffect(() => {
    setSelectedCount(prompt.count);
    setSelectedDifficulty(prompt.difficulty);
  }, [prompt.count, prompt.difficulty]);

  const baseCountOptions = [5, 10, 15, 20];
  const countOptions = prompt.count
    ? Array.from(new Set([...baseCountOptions, prompt.count])).sort(
        (left, right) => left - right,
      )
    : baseCountOptions;

  const title =
    prompt.intent === "flashcards" ? "Generate flashcards" : "Generate quiz";
  const countLabel =
    prompt.intent === "flashcards" ? "How many cards?" : "How many questions?";
  const description =
    prompt.count == null && prompt.difficulty == null
      ? "Choose the amount and difficulty, then generate directly from chat."
      : prompt.count == null
        ? `Difficulty is set to ${prompt.difficulty}. Choose how many ${prompt.intent === "flashcards" ? "flashcards" : "questions"} you want.`
        : `Count is set to ${prompt.count}. Choose the difficulty to continue.`;

  const handleGenerate = () => {
    if (!selectedCount || !selectedDifficulty || !onSubmit) return;
    onSubmit(
      `${selectedCount} ${selectedDifficulty} ${prompt.intent === "flashcards" ? "flashcards" : "quiz questions"}`,
    );
  };

  return (
    <Card className="border border-primary/15 bg-linear-to-br from-background via-primary/5 to-background p-4 shadow-sm">
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {countLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {countOptions.map((count) => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={selectedCount === count ? "active" : "outline"}
                className="min-w-12"
                disabled={!canInteract}
                onClick={() => setSelectedCount(count)}>
                {count}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Difficulty
          </p>
          <div className="flex flex-wrap gap-2">
            {(["easy", "medium", "hard"] as const).map((difficulty) => (
              <Button
                key={difficulty}
                type="button"
                size="sm"
                variant={
                  selectedDifficulty === difficulty ? "active" : "outline"
                }
                disabled={!canInteract}
                onClick={() => setSelectedDifficulty(difficulty)}>
                {difficulty[0].toUpperCase() + difficulty.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {canInteract
              ? "This will continue the chat with your selected options."
              : "Only the latest study prompt can be submitted from here."}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!canInteract || !selectedCount || !selectedDifficulty}
            onClick={handleGenerate}>
            {prompt.intent === "flashcards"
              ? "Generate flashcards"
              : "Generate quiz"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Custom Theme ─── */
const customCodeTheme: any = {
  'code[class*="language-"]': {
    color: "#f8f8f2",
    background: "none",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.6",
    tabSize: "4",
    hyphens: "none",
  },
  'pre[class*="language-"]': {
    color: "#f8f8f2",
    background: "none",
    padding: "1.25rem",
    margin: "0",
    overflow: "auto",
  },
  comment: { color: "#6272a4" },
  prolog: { color: "#6272a4" },
  doctype: { color: "#6272a4" },
  cdata: { color: "#6272a4" },
  punctuation: { color: "#f8f8f2" },
  property: { color: "#ff79c6" },
  tag: { color: "#ff79c6" },
  constant: { color: "#bd93f9" },
  symbol: { color: "#bd93f9" },
  deleted: { color: "#ff5555" },
  boolean: { color: "#bd93f9" },
  number: { color: "#bd93f9" },
  selector: { color: "#50fa7b" },
  "attr-name": { color: "#50fa7b" },
  string: { color: "#f1fa8c" },
  char: { color: "#50fa7b" },
  builtin: { color: "#8be9fd" },
  inserted: { color: "#50fa7b" },
  operator: { color: "#ff79c6" },
  entity: { color: "#ff79c6", cursor: "help" },
  url: { color: "#ff79c6" },
  variable: { color: "#f8f8f2" },
  atrule: { color: "#8be9fd" },
  "attr-value": { color: "#f1fa8c" },
  function: { color: "#8be9fd" },
  keyword: { color: "#ff79c6" },
  regex: { color: "#f1fa8c" },
  important: { color: "#ff79c6", fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
};

/* ─── YouTube helpers ─── */
const YT_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w\-]+(?:[\?&][^\s"')>]*)*/g;

function extractYouTubeIds(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(YT_PATTERN)) {
    const url = match[0];
    const id = parseYouTubeId(url);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function parseYouTubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (u.hostname === "youtu.be")
      return u.pathname.slice(1).split("/")[0] || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.pathname.startsWith("/embed/"))
      return u.pathname.split("/embed/")[1]?.split("/")[0] || null;
    if (u.pathname.startsWith("/shorts/"))
      return u.pathname.split("/shorts/")[1]?.split("/")[0] || null;
  } catch {}
  return null;
}

function normalizeMathDelimiters(input: string): string {
  return input
    .split(/(```[\s\S]*?```)/g)
    .map((block) => {
      if (block.startsWith("```")) {
        return block;
      }

      return block
        .split(/(`[^`\n]*`)/g)
        .map((segment) => {
          if (segment.startsWith("`")) {
            return segment;
          }

          const withStandardDelimiters = segment
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) => {
              return `\n\n$$\n${expr.trim()}\n$$\n\n`;
            })
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr: string) => {
              return `$${expr.trim()}$`;
            });

          return withStandardDelimiters.replace(
            /(^|\n\s*\n)\[\s*([\s\S]+?)\s*\](?=\n\s*\n|$)/g,
            (match: string, prefix: string, expr: string) => {
              if (!looksLikeLatexMath(expr)) {
                return match;
              }

              return `${prefix}$$\n${expr.trim()}\n$$`;
            },
          );
        })
        .join("");
    })
    .join("");
}

function looksLikeLatexMath(input: string): boolean {
  return /\\[a-zA-Z]+|[_^]|[=<>]|\{.+\}/.test(input);
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-border mt-3 w-full">
      <div className="relative" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );
}

const markdownComponents = (
  copyToClipboard: (text: string, id: string) => void,
  copiedId: string | null,
  messageId: string,
  isUser: boolean,
  isStreaming: boolean,
) => ({
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match ? match[1] : "";

    const displayLang =
      lang === "cpp"
        ? "C++"
        : lang === "javascript"
          ? "JS"
          : lang.toUpperCase();

    return !inline && match ? (
      <div className="relative group/code my-6 rounded-2xl border border-white/5 bg-[#0d0d0d] shadow-2xl">
        {/* Sticky Header */}
        <div className="sticky top-100 z-100 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d0d0d] rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            {isStreaming ? (
              <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
            ) : (
              <Code2 className="h-4 w-4 text-zinc-400" />
            )}
            <span className="text-sm font-medium text-zinc-300 font-sans tracking-tight">
              {displayLang}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() =>
              copyToClipboard(
                String(children).replace(/\n$/, ""),
                messageId + "-code",
              )
            }>
            {copiedId === messageId + "-code" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="overflow-hidden">
          <SyntaxHighlighter
            style={customCodeTheme}
            language={match[1]}
            PreTag="div"
            className="m-0 bg-transparent"
            {...props}>
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      </div>
    ) : (
      <code
        className={cn(
          "rounded px-1.5 py-0.5 font-mono text-sm",
          isUser
            ? "bg-primary-foreground/20"
            : "bg-muted font-medium text-foreground",
        )}
        {...props}>
        {children}
      </code>
    );
  },
  ul: ({ children }: any) => (
    <ul className="list-disc pl-6 space-y-2 my-3">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-6 space-y-2 my-3">{children}</ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="text-2xl font-bold mt-8 mb-4 tracking-tight">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-xl font-bold mt-6 mb-3 tracking-tight">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }: any) => <p className="leading-relaxed my-3">{children}</p>,
  a: ({ children, href }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline font-medium transition-colors",
        isUser
          ? "text-foreground/90 hover:text-foreground"
          : "text-primary hover:text-primary/80",
      )}>
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 italic my-4 text-muted-foreground bg-muted/30 py-1 rounded-r-md">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-6 border border-border rounded-lg">
      <table className="min-w-full divide-y divide-border text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="px-4 py-3 bg-muted/50 font-semibold text-left">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-2.5 border-t border-border">{children}</td>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
});

interface MessageBubbleProps {
  message: Message;
  userName?: string;
  isStreaming?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCitationClick?: (citation: Citation) => void;
  onStudyPromptSubmit?: (reply: string) => void;
  canInteractWithStudyPrompt?: boolean;
}

export function MessageBubble({
  message,
  userName,
  isStreaming = false,
  isCollapsed = false,
  onToggleCollapse,
  onCitationClick,
  onStudyPromptSubmit,
  canInteractWithStudyPrompt = false,
}: MessageBubbleProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { personalization } = usePersonalization();
  const studyPrompt = parseStudyPrompt(message.content);
  const renderedContent = normalizeMathDelimiters(message.content);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  /* ─── USER BUBBLE ─── */
  if (message.role === "user") {
    const ytIds = extractYouTubeIds(message.content);
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col items-end gap-1.5 max-w-[85%] sm:max-w-[70%] md:max-w-[60%] min-w-0">
          <Card className="px-4 py-3 bg-primary/10 text-foreground border-primary/20 shadow-sm rounded-2xl rounded-tr-none">
            <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word selection:bg-primary selection:text-primary-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={
                  markdownComponents(
                    copyToClipboard,
                    copiedId,
                    message.id,
                    true,
                    false,
                  ) as any
                }>
                {renderedContent}
              </ReactMarkdown>
            </div>
            {message.files && message.files.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary/10 space-y-1.5">
                {message.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm opacity-90">
                    {file.type?.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate font-medium">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
            {formatTime(message.timestamp)}
          </span>
          {ytIds.length > 0 && (
            <div className="w-full space-y-2">
              {ytIds.map((id) => (
                <YouTubeEmbed key={id} videoId={id} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── AI RESPONSE ─── */
  return (
    <div className="flex gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-400 group py-2 ">
      <div className="shrink-0 mt-1 h-8 w-8 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-md border border-white/10">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-foreground selection:bg-primary selection:text-primary-foreground">
            {personalization.tutorName}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-tighter selection:bg-primary selection:text-primary-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>

        <div
          className={cn(
            "relative selection:bg-primary selection:text-primary-foreground",
            isCollapsed && "max-h-30 overflow-hidden",
          )}>
          {studyPrompt ? (
            <StudyPromptCard
              prompt={studyPrompt}
              canInteract={canInteractWithStudyPrompt}
              onSubmit={onStudyPromptSubmit}
            />
          ) : (
            <div
              onDragStart={(e) => e.preventDefault()}
              data-assistant-content
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none wrap-break-word text-foreground/90",
                "prose-p:my-3 prose-p:leading-relaxed",
                "prose-headings:text-foreground prose-headings:font-bold",
                "prose-strong:text-foreground",
                "prose-li:leading-relaxed",
                "prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0",
              )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={
                  markdownComponents(
                    copyToClipboard,
                    copiedId,
                    message.id,
                    false,
                    isStreaming,
                  ) as any
                }>
                {renderedContent}
              </ReactMarkdown>
            </div>
          )}

          {/* Gradient fade at the bottom of a collapsed message */}
          {isCollapsed && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-background to-transparent pointer-events-none" />
          )}
        </div>

        {/* Show more / Show less button below the content */}
        {!studyPrompt && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-xs font-medium text-primary/70 hover:text-primary transition-colors mt-0.5 ml-0 px-1 py-0.5 rounded hover:bg-primary/5">
            {isCollapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show more
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            )}
          </button>
        )}

        {!studyPrompt &&
          !isCollapsed &&
          extractYouTubeIds(message.content).map((id) => (
            <YouTubeEmbed key={id} videoId={id} />
          ))}

        {!studyPrompt &&
          !isCollapsed &&
          message.files &&
          message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {message.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50 rounded-full px-3 py-1.5 w-fit">
                  {file.type?.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate max-w-37.5">{file.name}</span>
                </div>
              ))}
            </div>
          )}

        {!studyPrompt && !isCollapsed && (
          <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted -ml-2 rounded-full px-3"
              onClick={() => copyToClipboard(message.content, message.id)}>
              {copiedId === message.id ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}

        {/* Source citations */}
        {!studyPrompt &&
          !isCollapsed &&
          message.citations &&
          message.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {message.citations.map((c) => (
                <button
                  key={c.idx}
                  onClick={() => onCitationClick?.(c)}
                  title={c.snippet}
                  className="inline-flex items-center gap-1 text-xs font-medium bg-muted/60 hover:bg-primary/15 text-muted-foreground hover:text-primary border border-border/60 rounded-full px-2.5 py-1 transition-colors">
                  <FileText className="h-3 w-3 shrink-0" />[{c.idx}] {c.title}
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
