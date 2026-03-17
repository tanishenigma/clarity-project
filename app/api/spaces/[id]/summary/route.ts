import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";
import SpaceSummaryModel from "@/lib/models/SpaceSummary";
import SpaceModel from "@/lib/models/Space";
import ContentModel from "@/lib/models/Content";

// GET - Retrieve persisted summary for a space
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const record = await SpaceSummaryModel.findOne({
      spaceId: id,
      userId,
    }).lean();

    if (!record) {
      return NextResponse.json({ summary: null });
    }

    return NextResponse.json({ summary: record });
  } catch (error) {
    console.error("[Summary GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 },
    );
  }
}

// POST - generate or save summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { userId, action, outline, quickReference } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // ── Save user edits ──────────────────────────────────────────────────────
    if (action === "save") {
      const updated = await SpaceSummaryModel.findOneAndUpdate(
        { spaceId: id, userId },
        {
          $set: {
            outline: outline ?? "",
            quickReference: quickReference ?? {},
            generatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      return NextResponse.json({ summary: updated });
    }

    // ── AI generation ────────────────────────────────────────────────────────
    if (action === "generate") {
      const [space, contents] = await Promise.all([
        SpaceModel.findById(id).lean(),
        ContentModel.find({ spaceId: id }).lean(),
      ]);

      if (!space) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }

      if (contents.length === 0) {
        return NextResponse.json(
          { error: "No content in this space to summarise" },
          { status: 400 },
        );
      }

      // Build context (capped at 8 000 chars)
      const contextParts: string[] = [];
      contextParts.push(`Space: "${space.name}"`);
      if (space.subject) contextParts.push(`Subject: ${space.subject}`);
      if (space.examTarget)
        contextParts.push(`Exam Target: ${space.examTarget}`);
      if (space.description)
        contextParts.push(`Description: ${space.description}`);

      const contentContext = contents
        .map((c) => {
          const text = c.processed?.rawText
            ? c.processed.rawText.substring(0, 800)
            : "";
          return `[${c.type?.toUpperCase() ?? "FILE"}] ${c.title}${text ? "\n" + text : ""}`;
        })
        .join("\n\n");
      contextParts.push("\n--- Study Materials ---\n" + contentContext);

      const contextString = contextParts.join("\n").substring(0, 8000);

      const userSettings = await getUserAPISettings(userId);
      const model = createAIClient(
        "gemini-2.5-flash-lite",
        0.3,
        userSettings,
        true,
      );

      const systemMsg = new SystemMessage(
        "You are an expert study-material summariser. " +
          "You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanations. " +
          "CRITICAL: The JSON values are HTML strings. Do NOT use LaTeX backslash sequences (\\sum, \\log, \\frac, \\alpha etc.) — they break JSON parsing. " +
          "Write formulas using plain Unicode (e.g. Σ, α, β, ≥, →) or HTML (e.g. x<sub>i</sub>, H<sub>2</sub>O). " +
          "Output raw JSON only.",
      );

      const prompt = `You are generating study notes for a student.

Based on the following study materials, produce a JSON object with exactly these two top-level keys:

1. "outline" — A structured, hierarchical HTML string (use <h2>, <h3>, <ul>, <li>, <p>, <strong>).
   The outline should cover the main topics, sub-topics, and key points in logical order.
   Make it thorough but concise (aim for 400-800 words of readable content as HTML).

2. "quickReference" — An object with EXACTLY these 8 keys. Each value is an HTML string using <ul><li> bullet lists (use <strong> for emphasis). Keep each section tight but complete:
   - "keyTerms": Key Terms & Concepts
   - "fundamentalTheories": Fundamental Theories & Principles
   - "essentialFormulas": Essential Formulas & Equations — write math using Unicode symbols (Σ, α, β, θ, →, ≈, ≥) and HTML sub/superscripts, NOT LaTeX backslash sequences
   - "keyExamples": Key Examples & Case Studies
   - "keyApplications": Key Applications & Use Cases
   - "factsToMemorize": Facts to Memorize (dates, numbers, constants)
   - "referenceInfo": Reference Information (standards, constants, lookup tables)
   - "conceptComparisons": Concept Comparisons & Contrasts (e.g. X vs Y)

IMPORTANT JSON RULES:
- All string values must be on a single line (no literal newlines inside strings).
- Do NOT use backslash sequences like \\sum, \\log, \\frac — use Unicode or HTML instead.
- Escape any double-quotes inside HTML as &quot;

If a section has no relevant content, output an empty string for that key.

Study Materials:
${contextString}

Return ONLY valid JSON like:
{
  "outline": "<h2>Topic</h2><ul><li>...</li></ul>",
  "quickReference": {
    "keyTerms": "<ul><li><strong>Term</strong>: definition</li></ul>",
    "fundamentalTheories": "...",
    "essentialFormulas": "<ul><li><strong>Entropy</strong>: H(X) = -Σ P(x) log P(x)</li></ul>",
    "keyExamples": "...",
    "keyApplications": "...",
    "factsToMemorize": "...",
    "referenceInfo": "...",
    "conceptComparisons": "..."
  }
}`;

      const response = await model.invoke([
        systemMsg,
        new HumanMessage(prompt),
      ]);
      const responseText = response.content.toString();

      // ── Robust JSON extraction ────────────────────────────────────────────
      let jsonText = responseText.trim();

      // 1. Strip markdown code fences if present
      const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonText = fenceMatch[1].trim();

      // 2. Extract outermost JSON object if there is surrounding text
      const objMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objMatch) jsonText = objMatch[0];

      // 3. Sanitise the JSON string so it can be parsed.
      //    Two classes of problems seen in practice:
      //      a) Bare newlines / tabs inside JSON string values
      //      b) Invalid escape sequences from LaTeX math:
      //         \sum \log \frac \alpha etc. — JSON only allows
      //         \" \\ \/ \b \f \n \r \t \uXXXX after a backslash.
      //    We walk the raw text character-by-character, tracking whether
      //    we're inside a JSON string, and fix both problems.
      const VALID_AFTER_BACKSLASH = new Set([
        '"',
        "\\",
        "/",
        "b",
        "f",
        "n",
        "r",
        "t",
        "u",
      ]);

      function sanitizeJsonString(raw: string): string {
        let result = "";
        let inString = false;
        let i = 0;
        while (i < raw.length) {
          const ch = raw[i];

          if (!inString) {
            // Outside a string: only " can start a string; no escapes possible.
            if (ch === '"') inString = true;
            result += ch;
            i++;
            continue;
          }

          // Inside a string:
          if (ch === "\\") {
            const next = raw[i + 1];
            if (next === undefined) {
              result += ch;
              i++;
              continue;
            }

            if (VALID_AFTER_BACKSLASH.has(next)) {
              // Valid JSON escape — keep as-is; skip both chars together
              result += ch + next;
              // For \uXXXX skip 4 more hex digits too (they're harmless to pass through)
              i += 2;
              continue;
            }

            // Invalid escape (e.g. \s, \l, \f already handled above but kept for safety)
            // — escape the backslash so \sum becomes \\sum
            result += "\\\\" + next;
            i += 2;
            continue;
          }

          if (ch === '"') {
            // Un-escaped quote ends the string
            inString = false;
            result += ch;
            i++;
            continue;
          }

          // Bare control characters inside strings
          if (ch === "\n") {
            result += "\\n";
            i++;
            continue;
          }
          if (ch === "\r") {
            result += "\\r";
            i++;
            continue;
          }
          if (ch === "\t") {
            result += "\\t";
            i++;
            continue;
          }

          result += ch;
          i++;
        }
        return result;
      }

      let generated: {
        outline: string;
        quickReference: Record<string, string>;
      };
      try {
        generated = JSON.parse(jsonText);
      } catch {
        // Try again after sanitising bare control characters inside strings
        try {
          generated = JSON.parse(sanitizeJsonString(jsonText));
        } catch {
          // Last resort: truncation recovery — find the last fully-closed
          // property and seal the JSON by appending the right closing tokens.
          try {
            const sanitized = sanitizeJsonString(jsonText);
            // Track the last good cut-point at each nesting depth.
            // depth 1 = inside the outer {} (after "outline", before/after "quickReference")
            // depth 2 = inside quickReference {} (after individual section keys)
            let depth = 0;
            let lastGoodDepth1 = 0; // last closed / comma at depth 1
            let lastGoodDepth2 = 0; // last closed / comma at depth 2
            let inStr = false;
            for (let i = 0; i < sanitized.length; i++) {
              const c = sanitized[i];
              if (inStr) {
                if (c === "\\") {
                  i++;
                  continue;
                }
                if (c === '"') {
                  inStr = false;
                  lastGoodDepth2 = depth === 2 ? i + 1 : lastGoodDepth2;
                }
                continue;
              }
              if (c === '"') {
                inStr = true;
                continue;
              }
              if (c === "{" || c === "[") depth++;
              else if (c === "}" || c === "]") {
                depth--;
                if (depth === 1) lastGoodDepth1 = i + 1;
                if (depth === 2) lastGoodDepth2 = i + 1;
              } else if (c === ",") {
                if (depth === 1) lastGoodDepth1 = i + 1;
                if (depth === 2) lastGoodDepth2 = i + 1;
              }
            }

            let truncated: string;
            // Prefer recovering as much of quickReference as possible (depth 2)
            if (lastGoodDepth2 > lastGoodDepth1) {
              truncated =
                sanitized.slice(0, lastGoodDepth2).trimEnd().replace(/,$/, "") +
                "}}";
            } else {
              truncated =
                sanitized.slice(0, lastGoodDepth1).trimEnd().replace(/,$/, "") +
                "}}";
            }
            generated = JSON.parse(truncated);
          } catch (e2) {
            console.error(
              "[Summary] Failed to parse AI response:",
              jsonText.slice(0, 800),
              e2,
            );
            return NextResponse.json(
              { error: "AI returned invalid JSON — please try again" },
              { status: 500 },
            );
          }
        }
      }

      const saved = await SpaceSummaryModel.findOneAndUpdate(
        { spaceId: id, userId },
        {
          $set: {
            outline: generated.outline ?? "",
            quickReference: generated.quickReference ?? {},
            generatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      return NextResponse.json({ summary: saved });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Summary POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to process summary request" },
      { status: 500 },
    );
  }
}
