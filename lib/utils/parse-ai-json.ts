/**
 * Robustly parse a JSON string returned by any AI provider.
 *
 * Problems this handles (all observed in production):
 *  1. LaTeX unescaped backslashes  — e.g. \log, \alpha, \frac, \nabla, \theta
 *                                    (invalid JSON or silently corrupted)
 *  2. Markdown code fences         — ```json ... ```
 *  3. Prose wrapping the JSON      — "Here are your flashcards:\n[...]"
 *  4. Truncated JSON objects       — bracket-closing repair
 *
 * Strategy — three progressive parse attempts so valid JSON always wins:
 *   Pass 1 — parse as-is (handles already-correct responses).
 *   Pass 2 — conservative fix: double `\` that are followed by chars that are
 *             NOT valid JSON single-char escapes and NOT the start of \uXXXX.
 *             Catches: \min, \alpha, \left, \sum, \cdot, \log, \pi …
 *             (preserves: \n \t \r \b \f since those are valid JSON escapes)
 *   Pass 3 — aggressive fix: double ALL single `\` except `\"` `\\` `\/` and
 *             `\uXXXX`. This additionally fixes LaTeX sequences that begin with
 *             a valid JSON escape letter: \frac (\f), \nabla (\n), \theta (\t),
 *             \right (\r), \beta (\b). Deliberately turns them into
 *             literal-backslash sequences (\frac → \\frac) so the rendered
 *             LaTeX is correct.
 *
 * Usage:
 *   const data = parseAIJson(responseText);        // unknown
 *   const cards = parseAIJson<Card[]>(responseText);
 */
export function parseAIJson<T = unknown>(raw: string): T {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let text = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Extract the outermost JSON array or object
  //    Prefer array when the response starts with [ (flashcards, quizzes)
  const arrayStart = text.indexOf("[");
  const objectStart = text.indexOf("{");

  let jsonText: string;
  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    const lastBracket = text.lastIndexOf("]");
    jsonText =
      lastBracket !== -1
        ? text.slice(arrayStart, lastBracket + 1)
        : text.slice(arrayStart);
  } else if (objectStart !== -1) {
    const lastBrace = text.lastIndexOf("}");
    jsonText =
      lastBrace !== -1
        ? text.slice(objectStart, lastBrace + 1)
        : text.slice(objectStart);
  } else {
    jsonText = text;
  }

  // ── Pass 1: attempt parse with no modifications ──────────────────────────
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // continue to fixup passes
  }

  // ── Pre-pass: escape LaTeX sequences that are definitively invalid in JSON ──
  // These characters can never form a valid JSON escape after `\`, so we
  // double every `\` that precedes them regardless of surrounding context.
  // Most common in math notation: \| (norm), \{ \} (braces), \, \! \; \:
  // (spacing), \  (forced space), \^ \_ (superscript/subscript outside $).
  const latexPreProcessed = jsonText.replace(/\\([|{}\,!;: ^_])/g, "\\\\$1");
  if (latexPreProcessed !== jsonText) {
    try {
      return JSON.parse(latexPreProcessed) as T;
    } catch {
      // fall through — let the conservative/aggressive passes handle the rest
    }
  }

  // ── Pass 2: conservative fix ─────────────────────────────────────────────
  //    Double `\` that start sequences which are definitely invalid JSON.
  //    Valid JSON single-char escapes: " \ / b f n r t
  //    Valid multi-char escape:        uXXXX
  //    Preserves \n \t etc. in case the AI used them as real newline escapes.
  const conservative = jsonText.replace(
    /\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g,
    "\\\\",
  );

  try {
    return JSON.parse(conservative) as T;
  } catch {
    // continue to aggressive pass
  }

  // ── Pass 3: aggressive fix ───────────────────────────────────────────────
  //    Also double `\b` `\f` `\n` `\r` `\t` when they appear inside what is
  //    clearly a LaTeX math context.  We do this by excluding ONLY `\"`, `\\`,
  //    `\/`, and `\uXXXX` from doubling — everything else is treated as an
  //    improperly escaped LaTeX command.
  const aggressive = jsonText.replace(/\\(?!["\\/]|u[0-9a-fA-F]{4})/g, "\\\\");

  try {
    return JSON.parse(aggressive) as T;
  } catch (aggressiveErr) {
    // ── Pass 4 (objects only): bracket-closing repair after aggressive fix ──
    if (aggressive.trimStart().startsWith("{")) {
      try {
        return JSON.parse(closeOpenBrackets(aggressive)) as T;
      } catch {
        // fall through
      }
    }
    throw aggressiveErr;
  }
}

function closeOpenBrackets(str: string): string {
  const lastBrace = str.lastIndexOf("}");
  if (lastBrace === -1) throw new Error("No closing brace found");
  let s = str.substring(0, lastBrace + 1);

  const stack: string[] = [];
  let inStr = false;
  let esc = false;

  for (const ch of s) {
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "[") stack.push("]");
    else if (ch === "{") stack.push("}");
    else if (ch === "]" || ch === "}") stack.pop();
  }

  return s + stack.reverse().join("");
}
