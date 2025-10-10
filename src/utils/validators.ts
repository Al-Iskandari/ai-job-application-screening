import { Request } from "express";
import fs from 'fs';

export function validateUploadRequest(req: Request) {
  const { fileSize, fileType } = req.body;
  if (!fileType.includes("pdf"))  throw new Error("INVALID_FILE_TYPE");
  if (fileSize=== 0) throw new Error("EMPTY_FILE");
  if (fileSize > 10 * 1024 * 1024) throw new Error("LIMIT_FILE_SIZE");
}

export function validatePdfBuffer(buf: Buffer) {
  if (!buf || !buf.length) return false;
  // check PDF signature: first bytes "%PDF"
  const sig = buf.slice(0, 4).toString('utf8');
  return sig === '%PDF';
}

export function validateLLMJson(text: string) {
  try {
    // Remove Markdown code fences or explanation text
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const json = JSON.parse(cleaned);
    console.log("Validated LLM JSON:", json);
    return json;
  } catch (error: any) {
    console.error("LLM JSON validation failed:", error);
    throw new Error("Invalid JSON format from model output.");
  }
}

