import { AIClient } from "../ai-client";
import type { APISettings } from "../types";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { parseAIJson } from "../utils/parse-ai-json";

export interface GraphUpdate {
  expressions: Array<{
    id: string;
    latex: string;
    color?: string;
    hidden?: boolean;
  }>;
  viewport?: {
    xmin: number;
    xmax: number;
    ymin?: number;
    ymax?: number;
  };
  annotations?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
  }>;
}

export interface AgentFeedback {
  agentId: string;
  timestamp: Date;
  analysis: string;
  suggestions: string[];
  graphUpdate?: GraphUpdate;
}

/**
 * Functional factory for creating a Dynamic Desmos Manager.
 * Replaces the class-based approach using closures for state management.
 */
export function createDynamicDesmosManager(
  io?: any,
  userSettings?: APISettings,
) {
  // --- Private State ---
  const mathAgent = new AIClient(
    "gemini-2.5-flash-lite",
    0.7,
    userSettings,
    /* jsonMode */ true,
  );
  const analyzerAgent = new AIClient(
    "gemini-2.5-flash-lite",
    0.8,
    userSettings,
  );
  let currentGraph: GraphUpdate = { expressions: [] };
  let feedbackLoop: AgentFeedback[] = [];

  // --- Internal/Private Functions ---

  /**
   * Math Agent: Generates or updates mathematical expressions
   */
  const mathAgentStep = async (
    userRequest: string,
    feedback: AgentFeedback[],
    iteration: number,
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
    }>,
    currentAiResponse?: string,
  ): Promise<{
    reasoning: string;
    graphUpdate: GraphUpdate;
  }> => {
    const feedbackContext =
      feedback.length > 0
        ? `\n\nPrevious feedback from Analyzer:\n${feedback
            .map(
              (f) =>
                `- ${f.analysis}\n  Suggestions: ${f.suggestions.join(", ")}`,
            )
            .join("\n")}`
        : "";

    const historyContext =
      conversationHistory && conversationHistory.length > 0
        ? `\n\nConversation history (for context — understand what pronouns like "it", "this", "that" refer to):\n${conversationHistory
            .slice(-10)
            .map(
              (m) =>
                `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 600)}`,
            )
            .join("\n")}`
        : "";

    // The AI tutor's response for this turn is the most direct spec of what to draw.
    const aiResponseContext = currentAiResponse
      ? `\n\n## ★ AI TUTOR'S CURRENT RESPONSE (highest priority — draw EXACTLY what this describes):\n${currentAiResponse.substring(0, 1500)}`
      : "";

    const prompt = `You are an expert Desmos graphing agent. Your job is to translate ANY visual request — mathematical functions, concept diagrams, signal waveforms, timing diagrams, step functions, etc. — into accurate, beautiful Desmos expressions.

User request: "${userRequest}"
Iteration: ${iteration}
${aiResponseContext}
${historyContext}
${feedbackContext}

## STEP 1 — Resolve context from conversation history
Read the full conversation history above before generating anything.
- Identify what the user is actually referring to with pronouns or shorthand ("it", "the differential version", "the graph", "that function").
- NEVER assume "differential" means calculus; it may mean Differential Manchester Encoding, differential equations, etc.
- If the conversation is about signals, protocols, or timing — draw that, NOT a generic math function.

## STEP 2 — Choose the RIGHT curve type

### A. SMOOTH CONCEPT / ILLUSTRATION CURVES (Dunning-Kruger, learning curves, adoption curves, dose-response, etc.)
These MUST use a smooth continuous function — NEVER connect key points with straight line segments.

Technique: use a cubic or quartic polynomial that is shaped to pass through the key points.
Given N key points (x₁,y₁)…(xₙ,yₙ), fit a polynomial. For 4–5 points a cubic works well.

Quick cubic recipe for a "rise–dip–rise" shape on x∈[0,100], y∈[0,100]:
  Dunning-Kruger style: y = a(x-p)^3 + b(x-p)^2 + c(x-p) + d  where p shifts the inflection.

**Concrete Dunning-Kruger example (use these coefficients if asked about DK / confidence vs knowledge):**
  Main curve:   y = -0.00021x^4 + 0.034x^3 - 1.8x^2 + 32x + 5  {0 \\le x \\le 100}
  Key points to mark:   (10, 85), (30, 28), (70, 60), (100, 80)
  Annotations: "Peak of Mount Stupid" at (10,85), "Valley of Despair" at (30,28),
               "Slope of Enlightenment" at (70,60), "Plateau of Enlightenment" at (100,80)

**For other smooth concept curves (S-curves, bell curves, growth curves):**
  S-curve (logistic):  y = \\frac{L}{1+e^{-k(x-x_0)}}
  Bell/normal:         y = A \\cdot e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}
  Exponential growth:  y = A \\cdot e^{kx}
  Exponential decay:   y = A \\cdot e^{-kx} + C
  Power law:           y = A \\cdot x^n

Choose coefficients so the curve passes through the key conceptual landmarks described.

### B. SIGNAL / WAVEFORM / TIMING DIAGRAMS
Use piecewise notation for flat segments:
  y = \\left\\{a \\le x \\le b: v_1, b \\le x \\le c: v_2\\right\\}
For instantaneous vertical transitions: x = t \\left\\{-1 \\le y \\le 1\\right\\}
Label each bit period with an annotation.

### C. STANDARD MATH FUNCTIONS
Plot exactly as given: y = \\sin(x), y = x^2, y = \\frac{1}{x}, etc.
Restrict domain when needed: y = \\sqrt{x} \\left\\{x \\ge 0\\right\\}

**CRITICAL for type C:** The FIRST expression in the array MUST be the curve equation itself (e.g. \`"latex": "y=x^2"\`).
Do NOT add sample-point expressions like \`(0,0)\` for standard math — they are unnecessary and pollute the graph. Output ONLY the equation(s).

## STEP 3 — Add labeled point markers (CONCEPT CURVES ONLY)
This step applies ONLY to type A (concept/illustration curves), NOT to type B or C.
For each key landmark on a concept curve, add a separate expression for just that point so it shows as a dot:
  {"id": "p1", "latex": "(10, 85)", "color": "#ffffff"}
Then put the label in the annotations array at the same coordinates.
For type B (signals) and type C (standard math), leave the annotations array empty — do NOT create sample-point expressions.

## OUTPUT FORMAT
${iteration > 1 ? "Refine based on analyzer feedback — fix the curve shape or labels as requested." : ""}

Respond ONLY with valid JSON (no markdown fences, no prose).

**Type C example (standard math — quadratic):**
{
  "reasoning": "User wants a quadratic; type C standard math. Plot y=x^2 as a single curve with no sample points.",
  "expressions": [
    {"id": "expr1", "latex": "y=x^2", "color": "#c74440"}
  ],
  "viewport": {"xmin": -5, "xmax": 5, "ymin": -2, "ymax": 25},
  "annotations": []
}

**Type A example (concept curve — Dunning-Kruger):**
{
  "reasoning": "Dunning-Kruger concept curve; type A smooth polynomial. Using quartic with DK coefficients.",
  "expressions": [
    {"id": "expr1", "latex": "y=-0.00021x^4+0.034x^3-1.8x^2+32x+5\\\\left\\\\{0\\\\le x\\\\le100\\\\right\\\\}", "color": "#e07b39"},
    {"id": "p1", "latex": "(10,85)", "color": "#ffffff"},
    {"id": "p2", "latex": "(30,28)", "color": "#ffffff"}
  ],
  "viewport": {"xmin": -5, "xmax": 110, "ymin": -10, "ymax": 110},
  "annotations": [
    {"id": "a1", "text": "Peak of Mount Stupid", "x": 10, "y": 90},
    {"id": "a2", "text": "Valley of Despair", "x": 30, "y": 20}
  ]
}

LaTeX tips: x^2 powers, \\sin(x) trig, \\frac{a}{b} fractions, \\left\\{...\\right\\} piecewise, e^{...} exp.
IMPORTANT: All backslashes in latex strings must be doubled in JSON: \\\\frac, \\\\sin, \\\\left, \\\\right.`;

    const response = await mathAgent.invoke([new HumanMessage(prompt)]);
    const content = response.content.toString();

    // Extract JSON from response using the robust parser (handles LaTeX backslashes
    // from Groq / euri / Gemini without corrupting \frac, \nabla, \theta, etc.)
    let parsed: any;
    try {
      parsed = parseAIJson<any>(content);
    } catch (firstErr) {
      // ── Repair pass: ask the model to return ONLY the JSON it just produced ──
      console.warn(
        "[MathAgent] Initial parse failed — raw content:\n",
        content.substring(0, 800),
        "\n[MathAgent] Attempting repair prompt…",
      );
      try {
        const repairResponse = await mathAgent.invoke([
          new HumanMessage(prompt),
          { role: "assistant", content } as any,
          new HumanMessage(
            "Your previous reply was not valid JSON. Output ONLY the raw JSON object — no markdown fences, no prose, no explanation. Start your reply with { and end with }.",
          ),
        ]);
        parsed = parseAIJson<any>(repairResponse.content.toString());
      } catch (repairErr) {
        console.error(
          "[MathAgent] Repair attempt also failed:\n",
          (repairErr as Error).message,
        );
        throw new Error("Math agent failed to generate valid JSON");
      }
    }

    return {
      reasoning: parsed.reasoning || "Generated mathematical expressions",
      graphUpdate: {
        expressions: parsed.expressions || [],
        viewport: parsed.viewport,
        annotations: parsed.annotations || [],
      },
    };
  };

  /**
   * Analyzer Agent: Reviews graph and provides feedback
   */
  const analyzerAgentStep = async (
    userRequest: string,
    graphToAnalyze: GraphUpdate,
    iteration: number,
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
    }>,
  ): Promise<{
    analysis: string;
    suggestions: string[];
    satisfied: boolean;
  }> => {
    const historyContext =
      conversationHistory && conversationHistory.length > 0
        ? `\n\nConversation history (use this to understand what the user actually wants graphed):\n${conversationHistory
            .slice(-10)
            .map(
              (m) =>
                `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 600)}`,
            )
            .join("\n")}`
        : "";

    const prompt = `You are a strict visualization critic for a Desmos graphing agent.

Original user request: "${userRequest}"
Iteration: ${iteration}
${historyContext}

Current graph expressions:
${JSON.stringify(graphToAnalyze, null, 2)}

Use the conversation history to understand what the user actually asked for.

## WHAT TO CHECK

### For CONCEPT / ILLUSTRATION curves (Dunning-Kruger, learning curves, S-curves, etc.):
- REJECT if the curve is made of straight line segments (piecewise linear) — concept curves must be smooth.
- REJECT if the overall shape is wrong (e.g. a simple decay when a rise-dip-rise shape is needed).
- REJECT if key landmark points (peaks, valleys, inflection points) are missing or misplaced.
- REJECT if there are no annotations labeling the landmark points.
- APPROVE only if it is a smooth continuous curve with the correct shape and all landmarks labeled.

### For SIGNAL / WAVEFORM diagrams:
- REJECT if the shape doesn't match the requested encoding/protocol.
- REJECT if vertical transitions or bit-period labels are missing.

### For MATH FUNCTIONS:
- REJECT if the function plotted is not literally what was asked.
- CHECK that domain restrictions are correct and the viewport shows the interesting region.
- APPROVE a standard math function that has a correct \`y=f(x)\` expression even if it has NO point markers or annotations — those are not required for type C.

### Always check:
- Viewport: does it show the full interesting range without excessive whitespace?
- For CONCEPT curves only: are key points expressed as separate (x,y) dot expressions, and are all key landmarks labeled with annotations?
- For MATH FUNCTIONS: do NOT require point markers or annotations — a single curve expression is sufficient.
- For standard math functions: the correct \`y=f(x)\` expression is present and the viewport is sensible.

Respond ONLY with JSON:
{
  "analysis": "Detailed critique covering shape correctness, smoothness, landmarks, and labels",
  "suggestions": ["specific fix 1", "specific fix 2"],
  "satisfied": false
}

Set "satisfied": true when:
- For concept curves: the curve shape is demonstrably correct AND key landmark points are labeled.
- For signal diagrams: the shape matches the requested protocol.
Be strict about shape correctness, but do NOT require point markers or annotations for standard math functions.`;

    const response = await analyzerAgent.invoke([new HumanMessage(prompt)]);
    const content = response.content.toString();

    let parsed: any;
    try {
      parsed = parseAIJson<any>(content);
    } catch {
      return {
        analysis: "Unable to analyze",
        suggestions: [],
        satisfied: true,
      };
    }

    return {
      analysis: parsed.analysis || "Analysis complete",
      suggestions: parsed.suggestions || [],
      satisfied: parsed.satisfied ?? true,
    };
  };

  /**
   * Broadcast graph update to connected clients
   */
  const broadcastGraphUpdate = (
    sessionId: string,
    graphUpdate: GraphUpdate,
  ) => {
    if (io) {
      io.to(sessionId).emit("graph:update", {
        timestamp: new Date(),
        graph: graphUpdate,
      });
    }
  };

  const startAgentLoop = async (
    userRequest: string,
    sessionId?: string,
    maxIterations: number = 3,
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
    }>,
    currentAiResponse?: string,
  ): Promise<{ finalGraph: GraphUpdate; conversationLog: string[] }> => {
    console.log("DesmosManager.startAgentLoop called:", {
      userRequest,
      maxIterations,
    });

    const conversationLog: string[] = [];
    let iteration = 0;

    conversationLog.push(`USER: ${userRequest}`);

    try {
      while (iteration < maxIterations) {
        iteration++;
        conversationLog.push(`\n--- ITERATION ${iteration} ---`);

        // Step 1: Math Agent generates/updates graph
        console.log(`Math Agent iteration ${iteration}...`);
        let mathResponse: Awaited<ReturnType<typeof mathAgentStep>>;
        try {
          mathResponse = await mathAgentStep(
            userRequest,
            feedbackLoop,
            iteration,
            conversationHistory,
            currentAiResponse,
          );
        } catch (mathErr) {
          const msg =
            mathErr instanceof Error ? mathErr.message : String(mathErr);
          console.error(
            `[DesmosManager] Math agent iteration ${iteration} failed:`,
            msg,
          );
          conversationLog.push(`MATH AGENT ERROR (iter ${iteration}): ${msg}`);
          // Keep any expressions already generated in a prior iteration
          if (currentGraph.expressions.length > 0) break;
          // Otherwise skip to the next iteration
          continue;
        }
        conversationLog.push(`MATH AGENT: ${mathResponse.reasoning}`);

        // Update local state graph
        currentGraph = mathResponse.graphUpdate;
        console.log(`Graph updated:`, currentGraph);

        if (sessionId) {
          broadcastGraphUpdate(sessionId, currentGraph);
        }

        // Step 2: Analyzer Agent reviews the graph
        const analysisResponse = await analyzerAgentStep(
          userRequest,
          mathResponse.graphUpdate,
          iteration,
          conversationHistory,
        );
        conversationLog.push(`ANALYZER: ${analysisResponse.analysis}`);

        // Add feedback to loop
        feedbackLoop.push({
          agentId: "analyzer",
          timestamp: new Date(),
          analysis: analysisResponse.analysis,
          suggestions: analysisResponse.suggestions,
          graphUpdate: mathResponse.graphUpdate,
        });

        // Step 3: Check if satisfied
        if (analysisResponse.satisfied) {
          conversationLog.push("\n✓ Analyzer satisfied with result!");
          break;
        }

        // Step 4: Math agent will use feedback in next iteration
        conversationLog.push(
          `FEEDBACK: ${analysisResponse.suggestions.join(", ")}`,
        );
      }

      console.log("Agent loop complete:", {
        iterations: iteration,
        expressionCount: currentGraph.expressions.length,
        finalGraph: currentGraph,
      });

      return {
        finalGraph: currentGraph,
        conversationLog,
      };
    } catch (error) {
      console.error("Error in agent loop:", error);
      conversationLog.push(
        `ERROR: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {
        finalGraph: currentGraph,
        conversationLog,
      };
    }
  };

  /**
   * Clear feedback loop for new request
   */
  const resetFeedbackLoop = () => {
    feedbackLoop = [];
    currentGraph = { expressions: [] };
  };

  /**
   * Get current graph state
   */
  const getCurrentGraph = (): GraphUpdate => currentGraph;

  /**
   * Get feedback history
   */
  const getFeedbackHistory = (): AgentFeedback[] => feedbackLoop;

  // Return the public interface
  return {
    startAgentLoop,
    resetFeedbackLoop,
    getCurrentGraph,
    getFeedbackHistory,
  };
}
