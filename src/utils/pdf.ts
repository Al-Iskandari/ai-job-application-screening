import fs from "fs";
import { createRequire } from "module";

const createRequireModule = createRequire(import.meta.url);
const pdfParse = createRequireModule("pdf-parse");

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  const text = (data && data.text) ? data.text : '';
  // basic normalization
  return text.replace(/\r\n/g, '\n').trim();
}
