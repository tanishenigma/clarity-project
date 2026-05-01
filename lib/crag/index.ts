/**
 * CRAG Pipeline — LangGraph orchestrator
 *
 * Implements the Corrective RAG graph:
 *
 *   [retrieve] → [grade_documents] → [generate]
 *                       ↓ (low confidence)
 *               [web_search] → [generate]
 *
 * Each node is a LangGraph StateGraph node. The conditional edge after
 * grade_documents decides whether to use space docs or web search results.
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { retrieve } from "./retriever";
import { correctContext } from "./corrector";
import { generateAnswer } from "./generator";
import type { RetrievedDoc } from "./retriever";
import type { APISettings } from "@/lib/types";

// ── Graph state ───────────────────────────────────────────────────────────────

const CRAGState = Annotation.Root({
  query: Annotation<string>(),
  spaceId: Annotation<string>(),
  userId: Annotation<string>(),
  userSettings: Annotation<APISettings | undefined>(),

  retrieved: Annotation<RetrievedDoc[]>({
    value: (_prev, next) => next,
    default: () => [] as RetrievedDoc[],
  }),
  corrected: Annotation<RetrievedDoc[]>({
    value: (_prev, next) => next,
    default: () => [] as RetrievedDoc[],
  }),
  confidence: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 0,
  }),
  usedWebSearch: Annotation<boolean>({
    value: (_prev, next) => next,
    default: () => false,
  }),
  answer: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
});

type CRAGStateType = typeof CRAGState.State;

// ── Nodes ─────────────────────────────────────────────────────────────────────

async function nodeRetrieve(
  state: CRAGStateType,
): Promise<Partial<CRAGStateType>> {
  console.log("[CRAG] retrieve node — fetching space content");
  const retrieved = await retrieve(state.query, state.spaceId, state.userId);
  return { retrieved };
}

async function nodeGradeDocuments(
  state: CRAGStateType,
): Promise<Partial<CRAGStateType>> {
  console.log("[CRAG] grade_documents node — evaluating relevance");
  const { docs, confidence, usedWebSearch } = await correctContext(
    state.query,
    state.retrieved,
  );
  return { corrected: docs, confidence, usedWebSearch };
}

async function nodeGenerate(
  state: CRAGStateType,
): Promise<Partial<CRAGStateType>> {
  console.log(
    `[CRAG] generate node — source: ${state.usedWebSearch ? "web" : "space"}, confidence: ${state.confidence}`,
  );
  const { answer } = await generateAnswer(
    state.query,
    state.corrected,
    state.userSettings,
  );
  return { answer };
}

// ── Conditional edge: after grading, decide route ─────────────────────────────

function decideAfterGrading(state: CRAGStateType): "generate" {
  // Both paths (space docs + web search) now lead directly to generate —
  // the corrector already handled the web search fallback inside its node.
  // The conditional edge is kept for extensibility (e.g. adding a rewrite node).
  return "generate";
}

// ── Build graph ───────────────────────────────────────────────────────────────

const workflow = new StateGraph(CRAGState)
  .addNode("retrieve", nodeRetrieve)
  .addNode("grade_documents", nodeGradeDocuments)
  .addNode("generate", nodeGenerate)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "grade_documents")
  .addConditionalEdges("grade_documents", decideAfterGrading, {
    generate: "generate",
  })
  .addEdge("generate", END);

const cragGraph = workflow.compile();

// ── Public API ────────────────────────────────────────────────────────────────

export interface RAGResult {
  answer: string;
  confidence: number;
  usedWebSearch: boolean;
  sources: string[];
}

/**
 * Run the full Corrective RAG pipeline for a user query inside a space.
 *
 * @param query   - The student's question
 * @param spaceId - MongoDB ObjectId of the learning space
 * @param userId  - MongoDB ObjectId of the user
 */
export async function ragQuery(
  query: string,
  spaceId: string,
  userId: string,
  userSettings?: APISettings,
): Promise<RAGResult> {
  const finalState = await cragGraph.invoke({
    query,
    spaceId,
    userId,
    userSettings,
  });

  return {
    answer: finalState.answer,
    confidence: finalState.confidence,
    usedWebSearch: finalState.usedWebSearch,
    sources: finalState.corrected.map((d: RetrievedDoc) =>
      d.text.slice(0, 200),
    ),
  };
}
