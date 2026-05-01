/**
 * Extract all text from a PDF buffer using unpdf (Node.js + Edge compatible).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });
  return text;
}
