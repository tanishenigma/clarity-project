import path from "path";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createAIClient, getUserAPISettings } from "@/lib/ai-client";
import { invokeLocalOllama } from "@/lib/services/study-generation";
import { parseAIJson } from "@/lib/utils/parse-ai-json";
import { parseJsonlFile } from "@/lib/utils/jsonl-parser";
import { extractPdfText } from "@/lib/utils/pdf-extract";

const PYQ_DATASET_PATH = path.join(
  process.cwd(),
  "services/ml/data/pyq_dataset.jsonl",
);

const STOPWORDS = new Set([
  "about",
  "against",
  "after",
  "all",
  "also",
  "among",
  "analyse",
  "analyze",
  "and",
  "any",
  "appraise",
  "appraise",
  "apply",
  "are",
  "arrangement",
  "brief",
  "briefly",
  "carry",
  "case",
  "compare",
  "consider",
  "could",
  "define",
  "describe",
  "different",
  "differentiate",
  "discuss",
  "does",
  "draw",
  "each",
  "effect",
  "evaluate",
  "example",
  "examples",
  "explain",
  "features",
  "following",
  "from",
  "function",
  "give",
  "how",
  "importance",
  "indicated",
  "latest",
  "marks",
  "mention",
  "most",
  "name",
  "note",
  "objectives",
  "paper",
  "point",
  "process",
  "question",
  "questions",
  "recently",
  "relationship",
  "role",
  "size",
  "specific",
  "steps",
  "their",
  "them",
  "these",
  "through",
  "treated",
  "understand",
  "usage",
  "used",
  "using",
  "what",
  "when",
  "which",
  "why",
  "with",
  "write",
  "your",
]);

type ProviderName = "gemini" | "euri" | "groq" | "ollama" | "heuristic";

interface RawPyqRecord {
  id?: string;
  university?: string;
  exam_year?: string | number;
  semester?: string;
  exam_type?: string;
  exam_month?: string;
  course_code?: string;
  course_name?: string;
  departments?: string[];
  max_marks?: number | string;
  max_time?: string;
  question_no?: number | string | null;
  question_text?: string;
  marks?: number | string | null;
  raw_text?: string;
}

export interface AssessmentCourseOption {
  courseCode: string;
  courseName: string;
  questionCount: number;
  examTypes: string[];
  semesters: string[];
  departments: string[];
}

export interface AssessmentCatalog {
  courseOptions: AssessmentCourseOption[];
  totalQuestions: number;
}

export interface AssessmentRunInput {
  userId?: string;
  courseCode?: string;
  courseName?: string;
  examType?: string;
  semester?: string;
  topTopicCount?: number;
  predictedQuestionCount?: number;
  uploadedPdf?: {
    fileName: string;
    buffer: Buffer;
  };
}

export interface RankedTopic {
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

export interface PredictedQuestion {
  question: string;
  rationale: string;
  estimatedMarks: number;
  sourceTopics: string[];
}

export interface AssessmentRunResult {
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
    used: ProviderName;
    fallback: boolean;
    note?: string;
  };
}

interface NormalizedPyqQuestion {
  id: string;
  courseCode: string;
  courseName: string;
  examYear: string;
  semester: string;
  examType: string;
  departments: string[];
  marks: number | null;
  questionNo: number | null;
  questionText: string;
}

interface TopicAccumulator {
  phrase: string;
  score: number;
  frequency: number;
  totalMarks: number;
  questionIds: Set<string>;
  overlapWithUpload: boolean;
}

let datasetCache: NormalizedPyqQuestion[] | null = null;
let catalogCache: AssessmentCatalog | null = null;

export async function getAssessmentCatalog(): Promise<AssessmentCatalog> {
  if (catalogCache) {
    return catalogCache;
  }

  const questions = await loadDataset();
  const courseMap = new Map<
    string,
    {
      option: AssessmentCourseOption;
      nameCounts: Map<string, number>;
    }
  >();

  for (const question of questions) {
    const key = question.courseCode;
    const existing = courseMap.get(key);
    if (existing) {
      existing.option.questionCount += 1;
      existing.nameCounts.set(
        question.courseName,
        (existing.nameCounts.get(question.courseName) ?? 0) + 1,
      );
      if (!existing.option.examTypes.includes(question.examType)) {
        existing.option.examTypes.push(question.examType);
      }
      if (!existing.option.semesters.includes(question.semester)) {
        existing.option.semesters.push(question.semester);
      }
      for (const department of question.departments) {
        if (!existing.option.departments.includes(department)) {
          existing.option.departments.push(department);
        }
      }
      continue;
    }

    courseMap.set(key, {
      option: {
        courseCode: question.courseCode,
        courseName: question.courseName,
        questionCount: 1,
        examTypes: [question.examType],
        semesters: [question.semester],
        departments: [...question.departments],
      },
      nameCounts: new Map([[question.courseName, 1]]),
    });
  }

  catalogCache = {
    courseOptions: Array.from(courseMap.values())
      .map(({ option, nameCounts }) => ({
        ...option,
        courseName: selectDominantCourseName(nameCounts),
      }))
      .sort((left, right) => left.courseCode.localeCompare(right.courseCode)),
    totalQuestions: questions.length,
  };

  return catalogCache;
}

export async function runAssessmentAgent(
  input: AssessmentRunInput,
): Promise<AssessmentRunResult> {
  const questions = await filterDataset(input);

  if (questions.length === 0) {
    throw new Error(
      "No historical question papers matched the selected course or filters.",
    );
  }

  const uploadedPaper = input.uploadedPdf
    ? await analyzeUploadedPaper(input.uploadedPdf)
    : null;

  const rankedTopics = rankTopics({
    questions,
    uploadedPaperText: uploadedPaper?.text,
    topTopicCount: input.topTopicCount ?? 8,
  });

  const prediction = await generatePredictedQuestions({
    rankedTopics,
    questions,
    predictedQuestionCount: input.predictedQuestionCount ?? 5,
    userId: input.userId,
  });

  return {
    filters: {
      courseCode: input.courseCode?.trim() || undefined,
      courseName: input.courseName?.trim() || undefined,
      examType: normalizeLabel(input.examType) || undefined,
      semester: normalizeLabel(input.semester) || undefined,
    },
    datasetSummary: buildDatasetSummary(questions),
    uploadedPaper: uploadedPaper
      ? {
          fileName: uploadedPaper.fileName,
          extractedTextLength: uploadedPaper.text.length,
          extractedQuestionCount: uploadedPaper.questions.length,
        }
      : null,
    rankedTopics,
    predictedQuestions: prediction.predictedQuestions,
    provider: prediction.provider,
  };
}

async function loadDataset(): Promise<NormalizedPyqQuestion[]> {
  if (datasetCache) {
    return datasetCache;
  }

  const rawRows = await parseJsonlFile<RawPyqRecord>(PYQ_DATASET_PATH);
  datasetCache = rawRows
    .map(normalizeQuestion)
    .filter((question): question is NormalizedPyqQuestion => question !== null);

  return datasetCache;
}

function normalizeQuestion(
  raw: RawPyqRecord,
  index: number,
): NormalizedPyqQuestion | null {
  const questionText = cleanQuestionText(raw.question_text || "");
  if (!questionText) {
    return null;
  }

  return {
    id: raw.id || `pyq-${index + 1}`,
    courseCode: normalizeLabel(raw.course_code) || "UNKNOWN",
    courseName: normalizeCourseName(raw.course_name) || "Unknown Course",
    examYear: normalizeLabel(raw.exam_year) || "Unknown",
    semester: normalizeLabel(raw.semester) || "Unknown",
    examType: normalizeLabel(raw.exam_type) || "Unknown",
    departments: Array.isArray(raw.departments)
      ? raw.departments.map((department) => normalizeLabel(department))
      : [],
    marks: normalizeNumericValue(raw.marks),
    questionNo:
      typeof raw.question_no === "number"
        ? raw.question_no
        : typeof raw.question_no === "string" && raw.question_no.trim()
          ? Number.parseInt(raw.question_no, 10)
          : null,
    questionText,
  };
}

async function filterDataset(
  input: AssessmentRunInput,
): Promise<NormalizedPyqQuestion[]> {
  const questions = await loadDataset();
  const courseCode = normalizeLabel(input.courseCode);
  const courseName = input.courseName?.trim().toLowerCase();
  const examType = normalizeLabel(input.examType);
  const semester = normalizeLabel(input.semester);

  return questions.filter((question) => {
    if (courseCode && question.courseCode !== courseCode) {
      return false;
    }

    if (
      courseName &&
      !question.courseName.toLowerCase().includes(courseName) &&
      !question.courseCode.toLowerCase().includes(courseName)
    ) {
      return false;
    }

    if (examType && question.examType !== examType) {
      return false;
    }

    if (semester && question.semester !== semester) {
      return false;
    }

    return true;
  });
}

async function analyzeUploadedPaper(uploadedPdf: {
  fileName: string;
  buffer: Buffer;
}): Promise<{
  fileName: string;
  text: string;
  questions: string[];
}> {
  const rawText = await extractPdfText(uploadedPdf.buffer);
  const normalizedText = cleanQuestionText(rawText, { keepCase: false });
  return {
    fileName: uploadedPdf.fileName,
    text: normalizedText,
    questions: extractQuestionBlocks(normalizedText),
  };
}

function rankTopics({
  questions,
  uploadedPaperText,
  topTopicCount,
}: {
  questions: NormalizedPyqQuestion[];
  uploadedPaperText?: string;
  topTopicCount: number;
}): RankedTopic[] {
  const topicMap = new Map<string, TopicAccumulator>();
  const uploadedTokens = new Set(tokenize(uploadedPaperText || ""));

  for (const question of questions) {
    const tokens = tokenize(question.questionText);
    const candidates = buildCandidatePhrases(tokens);
    const questionWeight = 1 + (question.marks ?? 2) / 2;

    for (const candidate of candidates) {
      const phraseTokens = candidate.split(" ");
      const overlapWithUpload = phraseTokens.every((token) =>
        uploadedTokens.has(token),
      );
      const lengthWeight = 0.8 + phraseTokens.length * 0.45;
      const overlapBoost = overlapWithUpload ? 1.25 : 0;
      const scoreDelta = questionWeight * lengthWeight + overlapBoost;

      const existing = topicMap.get(candidate);
      if (!existing) {
        topicMap.set(candidate, {
          phrase: candidate,
          score: scoreDelta,
          frequency: 1,
          totalMarks: question.marks ?? 0,
          questionIds: new Set([question.id]),
          overlapWithUpload,
        });
        continue;
      }

      if (!existing.questionIds.has(question.id)) {
        existing.frequency += 1;
        existing.totalMarks += question.marks ?? 0;
        existing.questionIds.add(question.id);
      }
      existing.score += scoreDelta;
      existing.overlapWithUpload ||= overlapWithUpload;
    }
  }

  const minimumFrequency = questions.length >= 12 ? 2 : 1;
  const sortedTopics = Array.from(topicMap.values())
    .filter((topic) => topic.frequency >= minimumFrequency)
    .sort((left, right) => right.score - left.score);

  const selectedTopics: TopicAccumulator[] = [];
  for (const topic of sortedTopics) {
    if (selectedTopics.length >= topTopicCount) {
      break;
    }

    const isRedundant = selectedTopics.some((selected) => {
      const selectedWords = new Set(selected.phrase.split(" "));
      const topicWords = topic.phrase.split(" ");
      return topicWords.every((word) => selectedWords.has(word));
    });

    if (!isRedundant) {
      selectedTopics.push(topic);
    }
  }

  return selectedTopics.map((topic) => ({
    label: toTitleCase(topic.phrase),
    score: Number(topic.score.toFixed(2)),
    frequency: topic.frequency,
    totalMarks: topic.totalMarks,
    overlapWithUpload: topic.overlapWithUpload,
    representativeQuestions: questions
      .filter((question) => topic.questionIds.has(question.id))
      .sort(
        (left, right) =>
          (right.marks ?? 0) - (left.marks ?? 0) ||
          right.examYear.localeCompare(left.examYear),
      )
      .slice(0, 3)
      .map((question) => ({
        id: question.id,
        questionText: question.questionText,
        marks: question.marks,
        examYear: question.examYear,
        examType: question.examType,
      })),
  }));
}

async function generatePredictedQuestions({
  rankedTopics,
  questions,
  predictedQuestionCount,
  userId,
}: {
  rankedTopics: RankedTopic[];
  questions: NormalizedPyqQuestion[];
  predictedQuestionCount: number;
  userId?: string;
}): Promise<{
  predictedQuestions: PredictedQuestion[];
  provider: AssessmentRunResult["provider"];
}> {
  const heuristicQuestions = buildHeuristicPredictions(
    rankedTopics,
    questions,
    predictedQuestionCount,
  );

  if (rankedTopics.length === 0) {
    return {
      predictedQuestions: heuristicQuestions,
      provider: {
        used: "heuristic",
        fallback: true,
        note: "No strong topics were detected, so heuristic predictions were used.",
      },
    };
  }

  const prompt = buildPredictionPrompt(
    rankedTopics,
    questions,
    predictedQuestionCount,
  );

  try {
    const userSettings = userId ? await getUserAPISettings(userId) : undefined;
    const client = createAIClient(
      "gemini-2.5-flash-lite",
      0.35,
      userSettings,
      true,
    );
    const response = await client.invoke([
      new SystemMessage(
        "You are an exam prediction assistant. Return only valid JSON.",
      ),
      new HumanMessage(prompt),
    ]);
    const predictedQuestions = normalizePredictedQuestions(
      parseAIJson(response.content),
      predictedQuestionCount,
    );

    if (predictedQuestions.length > 0) {
      return {
        predictedQuestions,
        provider: {
          used: client.getPrimaryProvider() as ProviderName,
          fallback: false,
        },
      };
    }
  } catch (error) {
    console.warn("[AssessmentAgent] Provider generation failed:", error);
  }

  try {
    const rawResponse = await invokeLocalOllama(prompt, {
      temperature: 0.2,
      numPredict: 2400,
      timeoutMs: 90_000,
    });
    const predictedQuestions = normalizePredictedQuestions(
      parseAIJson(rawResponse),
      predictedQuestionCount,
    );

    if (predictedQuestions.length > 0) {
      return {
        predictedQuestions,
        provider: {
          used: "ollama",
          fallback: true,
        },
      };
    }
  } catch (error) {
    console.warn("[AssessmentAgent] Local Ollama generation failed:", error);
  }

  return {
    predictedQuestions: heuristicQuestions,
    provider: {
      used: "heuristic",
      fallback: true,
      note: "Provider generation was unavailable, so deterministic predictions were used.",
    },
  };
}

function buildHeuristicPredictions(
  rankedTopics: RankedTopic[],
  questions: NormalizedPyqQuestion[],
  predictedQuestionCount: number,
): PredictedQuestion[] {
  const averageMarks =
    Math.round(
      questions.reduce((total, question) => total + (question.marks ?? 0), 0) /
        Math.max(questions.length, 1),
    ) || 2;

  return rankedTopics.slice(0, predictedQuestionCount).map((topic, index) => {
    const promptStyle = index % 3;
    const question =
      promptStyle === 0
        ? `Explain ${topic.label.toLowerCase()} and discuss why it remains a frequently tested theme in previous year papers.`
        : promptStyle === 1
          ? `Discuss the core concepts, mechanism, and practical significance of ${topic.label.toLowerCase()}.`
          : `Compare major ideas connected to ${topic.label.toLowerCase()} and justify their exam relevance.`;

    return {
      question,
      rationale: `${topic.label} appeared ${topic.frequency} times with a weighted score of ${topic.score}.`,
      estimatedMarks:
        topic.representativeQuestions[0]?.marks ?? Math.max(averageMarks, 2),
      sourceTopics: [topic.label],
    };
  });
}

function normalizePredictedQuestions(
  raw: unknown,
  predictedQuestionCount: number,
): PredictedQuestion[] {
  const candidateArray = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as any).predictedQuestions)
      ? (raw as any).predictedQuestions
      : [];

  return candidateArray
    .map((item: unknown) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const question =
        typeof (item as any).question === "string"
          ? cleanQuestionText((item as any).question, { keepCase: true })
          : "";
      if (!question) {
        return null;
      }

      const rationale =
        typeof (item as any).rationale === "string"
          ? cleanQuestionText((item as any).rationale, { keepCase: true })
          : "Generated from historical topic frequency patterns.";
      const estimatedMarks =
        normalizeNumericValue((item as any).estimatedMarks) ?? 2;
      const sourceTopics = Array.isArray((item as any).sourceTopics)
        ? (item as any).sourceTopics
            .filter((topic: unknown) => typeof topic === "string")
            .map((topic: string) =>
              cleanQuestionText(topic, { keepCase: true }),
            )
            .filter(Boolean)
        : [];

      return {
        question,
        rationale,
        estimatedMarks,
        sourceTopics,
      };
    })
    .filter(
      (item: PredictedQuestion | null): item is PredictedQuestion =>
        item !== null,
    )
    .slice(0, predictedQuestionCount);
}

function buildPredictionPrompt(
  rankedTopics: RankedTopic[],
  questions: NormalizedPyqQuestion[],
  predictedQuestionCount: number,
): string {
  const summary = buildDatasetSummary(questions);
  const topicSummary = rankedTopics
    .slice(0, 6)
    .map(
      (topic, index) =>
        `${index + 1}. ${topic.label} | score=${topic.score} | frequency=${topic.frequency} | representative=${topic.representativeQuestions
          .map((question) => question.questionText)
          .join(" || ")}`,
    )
    .join("\n");

  return `Return ONLY valid JSON.

Generate ${predictedQuestionCount} predicted exam questions grounded in historical previous-year question patterns.

Dataset summary:
- Course: ${summary.courseCode || "Mixed"} - ${summary.courseName || "Mixed Courses"}
- Historical question count: ${summary.totalHistoricalQuestions}
- Average marks per question: ${summary.averageMarks}
- Exam types: ${summary.examTypes.join(", ") || "Unknown"}
- Semesters: ${summary.semesters.join(", ") || "Unknown"}

Top ranked topics:
${topicSummary}

Rules:
- Keep the questions plausible for the same course and exam style.
- Reflect the frequency-weighted ranking; use the top topics more strongly.
- Avoid copying any historical question verbatim.
- Rewrite OCR-noisy examples into clean academic English.
- Never repeat corrupted tokens or malformed wording from the source snippets.
- Estimated marks should be realistic integers.
- Return JSON in this exact shape:
{
  "predictedQuestions": [
    {
      "question": "...",
      "rationale": "...",
      "estimatedMarks": 3,
      "sourceTopics": ["..."]
    }
  ]
}`;
}

function buildDatasetSummary(questions: NormalizedPyqQuestion[]) {
  const courseCodes = uniqueValues(
    questions.map((question) => question.courseCode),
  );
  const courseNames = uniqueValues(
    questions.map((question) => question.courseName),
  );
  const examTypes = uniqueValues(
    questions.map((question) => question.examType),
  );
  const semesters = uniqueValues(
    questions.map((question) => question.semester),
  );
  const totalMarks = questions.reduce(
    (sum, question) => sum + (question.marks ?? 0),
    0,
  );
  const markedQuestions = questions.filter(
    (question) => question.marks !== null,
  );

  return {
    courseCode: courseCodes.length === 1 ? courseCodes[0] : null,
    courseName: courseNames.length === 1 ? courseNames[0] : null,
    totalHistoricalQuestions: questions.length,
    averageMarks:
      markedQuestions.length > 0
        ? Number((totalMarks / markedQuestions.length).toFixed(2))
        : 0,
    examTypes,
    semesters,
  };
}

function extractQuestionBlocks(text: string): string[] {
  const matches = Array.from(
    text.matchAll(
      /(?:^|\n)\s*q\s*\.?\s*(\d+)\s*[:.)-]?\s*([\s\S]*?)(?=(?:\n\s*q\s*\.?\s*\d+\s*[:.)-]?)|$)/gi,
    ),
  );

  return matches
    .map((match) => cleanQuestionText(match[2] || "", { keepCase: true }))
    .filter(Boolean);
}

function buildCandidatePhrases(tokens: string[]): string[] {
  const phrases = new Set<string>();
  const filteredTokens = tokens.filter((token) => token.length >= 4);

  for (let index = 0; index < filteredTokens.length; index += 1) {
    const unigram = filteredTokens[index];
    if (unigram.length >= 6) {
      phrases.add(unigram);
    }

    const bigram = filteredTokens.slice(index, index + 2);
    if (bigram.length === 2) {
      phrases.add(bigram.join(" "));
    }

    const trigram = filteredTokens.slice(index, index + 3);
    if (trigram.length === 3) {
      phrases.add(trigram.join(" "));
    }
  }

  return Array.from(phrases);
}

function tokenize(text: string): string[] {
  return cleanQuestionText(text)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOPWORDS.has(token) &&
        !/^\d+$/.test(token) &&
        !/[a-z]\d+[a-z]?/.test(token),
    );
}

function cleanQuestionText(
  text: string,
  options: { keepCase?: boolean } = {},
): string {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bCO\s*\d+\b/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return options.keepCase ? normalized : normalized.toLowerCase();
}

function normalizeNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    return Number.parseFloat(match[0]);
  }

  return null;
}

function normalizeLabel(value: unknown): string {
  if (typeof value === "number") {
    return String(value).trim().toUpperCase();
  }

  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeCourseName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/max\.?\s*time.*$/i, "")
    .replace(/max\.?\s*marks.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase());
}

function toTitleCase(value: string): string {
  return value.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function selectDominantCourseName(nameCounts: Map<string, number>): string {
  return (
    Array.from(nameCounts.entries())
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([name]) => name)
      .find(Boolean) || "Unknown Course"
  );
}
