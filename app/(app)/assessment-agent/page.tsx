"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";

interface AssessmentCourseOption {
  courseCode: string;
  courseName: string;
  questionCount: number;
  examTypes: string[];
  semesters: string[];
  departments: string[];
}

interface AssessmentCatalogResponse {
  courseOptions: AssessmentCourseOption[];
  totalQuestions: number;
}

interface RankedTopic {
  label: string;
  score: number;
  frequency: number;
  totalMarks: number;
  overlapWithUpload: boolean;
  representativeQuestions: Array<{
    id: string;
    questionText: string;
    marks: number | null;
    examYear: string;
    examType: string;
  }>;
}

interface PredictedQuestion {
  question: string;
  rationale: string;
  estimatedMarks: number;
  sourceTopics: string[];
}

interface AssessmentResult {
  filters: {
    courseCode?: string;
    courseName?: string;
    examType?: string;
    semester?: string;
  };
  datasetSummary: {
    courseCode: string | null;
    courseName: string | null;
    totalHistoricalQuestions: number;
    averageMarks: number;
    examTypes: string[];
    semesters: string[];
  };
  uploadedPaper: {
    fileName: string;
    extractedTextLength: number;
    extractedQuestionCount: number;
  } | null;
  rankedTopics: RankedTopic[];
  predictedQuestions: PredictedQuestion[];
  provider: {
    used: string;
    fallback: boolean;
    note?: string;
  };
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSubsequence(search: string, target: string): boolean {
  if (!search) return true;

  let searchIndex = 0;
  for (const char of target) {
    if (char === search[searchIndex]) {
      searchIndex += 1;
      if (searchIndex === search.length) {
        return true;
      }
    }
  }

  return false;
}

function getCourseSearchScore(
  value: string,
  search: string,
  keywords: string[] = [],
): number {
  const normalizedSearch = normalizeSearchValue(search);
  if (!normalizedSearch) {
    return 1;
  }

  const normalizedValue = normalizeSearchValue(value);
  const normalizedKeywords = keywords.map(normalizeSearchValue).filter(Boolean);
  const combined = [normalizedValue, ...normalizedKeywords].join(" ");
  const compressedSearch = normalizedSearch.replace(/\s+/g, "");
  const compressedCombined = combined.replace(/\s+/g, "");
  const searchTokens = normalizedSearch.split(" ").filter(Boolean);

  if (normalizedValue.startsWith(normalizedSearch)) {
    return 5;
  }

  if (normalizedValue.includes(normalizedSearch)) {
    return 4.5;
  }

  if (
    normalizedKeywords.some((keyword) => keyword.startsWith(normalizedSearch))
  ) {
    return 4;
  }

  if (searchTokens.every((token) => combined.includes(token))) {
    return 3.25;
  }

  if (isSubsequence(compressedSearch, compressedCombined)) {
    return 2.25;
  }

  return 0;
}

export default function AssessmentAgentPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<AssessmentCatalogResponse | null>(
    null,
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [courseQuery, setCourseQuery] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [predictedQuestionCount, setPredictedQuestionCount] = useState("5");
  const [topTopicCount, setTopTopicCount] = useState("8");

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const response = await fetch("/api/assessment-agent");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load dataset catalog.");
        }

        const data = payload.data as AssessmentCatalogResponse;
        setCatalog(data);
        setSelectedCourseCode(
          (current) => current || data.courseOptions[0]?.courseCode || "",
        );
      } catch (error) {
        setCatalogError(
          error instanceof Error ? error.message : "Failed to load catalog.",
        );
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, []);

  const selectedCourse = catalog?.courseOptions.find(
    (course) => course.courseCode === selectedCourseCode,
  );
  const maxTopicScore = Math.max(
    ...(result?.rankedTopics.map((topic) => topic.score) || [1]),
  );

  const handleRunAnalysis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      if (selectedCourseCode) {
        formData.append("courseCode", selectedCourseCode);
      }
      if (selectedExamType) {
        formData.append("examType", selectedExamType);
      }
      formData.append("topTopicCount", topTopicCount);
      formData.append("predictedQuestionCount", predictedQuestionCount);
      if (user?.id) {
        formData.append("userId", user.id);
      }

      const response = await fetch("/api/assessment-agent", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Assessment analysis failed.");
      }

      setResult(payload.data as AssessmentResult);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Assessment analysis failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Assessment Agent</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Run Analysis</CardTitle>
            <CardDescription>
              Choose a course from the JSONL dataset, then tune how many ranked
              topics and predicted questions to generate.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {catalogLoading ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Loading dataset catalog…</p>
              </div>
            ) : catalogError ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {catalogError}
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleRunAnalysis}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Course
                  </label>
                  <div className="overflow-hidden rounded-2xl border-none bg-background shadow-xs transition-[color,box-shadow] focus-within:border-none  focus-within:ring-ring/50">
                    <Command
                      shouldFilter
                      filter={(value, search, keywords) =>
                        getCourseSearchScore(value, search, keywords)
                      }
                      className="rounded-none border-0 bg-transparent">
                      <CommandInput
                        value={courseQuery}
                        onValueChange={setCourseQuery}
                        placeholder="Search by course code, name, or department…"
                        className="h-10"
                      />
                      <CommandList className="max-h-64 border-t bg-muted/10">
                        <CommandEmpty className="px-4 py-5 text-left text-sm text-muted-foreground">
                          No course matched that search.
                        </CommandEmpty>
                        {catalog?.courseOptions.map((course) => {
                          const isSelected =
                            course.courseCode === selectedCourseCode;

                          return (
                            <CommandItem
                              key={course.courseCode}
                              value={`${course.courseCode} ${course.courseName}`}
                              keywords={[
                                course.courseCode,
                                course.courseName,
                                ...course.departments,
                                ...course.examTypes,
                                ...course.semesters,
                              ]}
                              onSelect={() => {
                                setSelectedCourseCode(course.courseCode);
                                setSelectedExamType("");
                                setCourseQuery("");
                              }}
                              className="group items-start gap-3 rounded-none border-b border-border/50 px-4 py-3 last:border-b-0 transition-colors hover:bg-accent/70 data-[selected=true]:bg-accent/70">
                              <div
                                data-course-icon
                                className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/70 bg-background transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-data-[selected=true]:border-primary/30 group-data-[selected=true]:bg-primary/10">
                                {isSelected ? (
                                  <Check
                                    data-course-icon-mark
                                    className="h-3.5 w-3.5 text-primary transition-colors group-hover:text-foreground/80 group-data-[selected=true]:text-foreground/80"
                                  />
                                ) : (
                                  <Search
                                    data-course-icon-mark
                                    className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground/80 group-data-[selected=true]:text-foreground/80"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-foreground">
                                    {course.courseCode}
                                  </span>
                                  <span
                                    data-course-muted
                                    className="text-muted-foreground transition-colors group-hover:text-foreground/80 group-data-[selected=true]:text-foreground/80">
                                    •
                                  </span>
                                  <span
                                    data-course-muted
                                    className="text-muted-foreground transition-colors group-hover:text-foreground/80 group-data-[selected=true]:text-foreground/80">
                                    {course.courseName}
                                  </span>
                                </div>
                                <p
                                  data-course-muted
                                  className="text-xs text-muted-foreground transition-colors group-hover:text-foreground/80 group-data-[selected=true]:text-foreground/80">
                                  {course.questionCount} questions •{" "}
                                  {course.departments.join(", ") ||
                                    "multiple departments"}
                                </p>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </div>
                  {selectedCourse ? (
                    <div className="rounded-2xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Selected:
                      </span>{" "}
                      {selectedCourse.courseCode} • {selectedCourse.courseName}.{" "}
                      {selectedCourse.questionCount} historical questions across{" "}
                      {selectedCourse.departments.join(", ") ||
                        "multiple departments"}
                      .
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Exam Type
                  </label>
                  <select
                    value={selectedExamType}
                    onChange={(event) =>
                      setSelectedExamType(event.target.value)
                    }
                    className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <option value="">Any historical exam type</option>
                    {selectedCourse?.examTypes.map((examType) => (
                      <option key={examType} value={examType}>
                        {examType}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Ranked Topics
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={12}
                      value={topTopicCount}
                      onChange={(event) => setTopTopicCount(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Predicted Questions
                    </label>
                    <Input
                      type="number"
                      min={3}
                      max={8}
                      value={predictedQuestionCount}
                      onChange={(event) =>
                        setPredictedQuestionCount(event.target.value)
                      }
                    />
                  </div>
                </div>

                {submitError ? (
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}>
                  {isSubmitting
                    ? "Running assessment…"
                    : "Run Assessment Agent"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {result ? (
            <Card className="gap-0 overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle>Predicted Questions</CardTitle>
                <CardDescription>
                  Generated from the frequency-weighted topic stack and nearby
                  historical question patterns.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {result.predictedQuestions.length > 0 ? (
                  result.predictedQuestions.map((question, index) => (
                    <div
                      key={`${question.question}-${index}`}
                      className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-6 text-foreground">
                          Q{index + 1}. {question.question}
                        </p>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {question.estimatedMarks} marks
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {question.rationale}
                      </p>
                      {question.sourceTopics.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {question.sourceTopics.map((topic) => (
                            <span
                              key={topic}
                              className="rounded-full border border-border/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    No predicted questions were generated for this run.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="gap-0 overflow-hidden border-dashed">
              <CardHeader>
                <CardTitle>Ready To Analyze</CardTitle>
                <CardDescription>
                  Run the Assessment Agent to populate predicted questions and
                  topic ranking from the selected PYQ corpus.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                  <p>
                    No analysis has been run yet. Choose a course and run the
                    pipeline to generate predicted questions and ranked topics.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {result ? (
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Topic Ranking</CardTitle>
            <CardDescription>
              Topics are ranked by historical recurrence and marks weight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {result.rankedTopics.length > 0 ? (
              result.rankedTopics.map((topic) => (
                <div
                  key={topic.label}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {topic.label}
                        </h3>
                        {topic.overlapWithUpload ? (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                            Uploaded paper overlap
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Frequency {topic.frequency} • Total marks{" "}
                        {topic.totalMarks}
                      </p>
                    </div>
                    <div className="min-w-28 text-left sm:text-right">
                      <p className="text-sm font-medium text-foreground">
                        Score {topic.score}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: `${Math.max(
                          (topic.score / maxTopicScore) * 100,
                          8,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {topic.representativeQuestions.map((question) => (
                      <div
                        key={question.id}
                        className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {question.examYear} {question.examType}
                        </span>
                        <span className="mx-2 text-border">•</span>
                        <span>{question.questionText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                No topics were ranked for this run.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
