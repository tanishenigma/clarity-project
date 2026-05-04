import { readFile } from "fs/promises";

export function parseJsonl<T>(content: string): T[] {
  const records: T[] = [];

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      records.push(JSON.parse(trimmed) as T);
    } catch (error) {
      console.warn(
        `[jsonl-parser] Skipping malformed JSONL row ${index + 1}:`,
        error,
      );
    }
  }

  return records;
}

export async function parseJsonlFile<T>(filePath: string): Promise<T[]> {
  const content = await readFile(filePath, "utf-8");
  return parseJsonl<T>(content);
}
