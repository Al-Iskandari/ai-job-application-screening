import { Request } from "express";

export function validateUploadRequest(req: Request) {
  const cv = (req.files as { [fieldname: string]: Express.Multer.File[]; })?.["cv"]?.[0];
  const project = (req.files as { [fieldname: string]: Express.Multer.File[]; })?.["project"]?.[0];
  if (!cv || !project) throw new Error("CV and project report are required.");
}

export function validateFileType(file: Express.Multer.File) {
  const allowed = ["application/pdf"];
  if (!allowed.includes(file.mimetype)) {
    throw new Error(`Invalid file type for ${file.originalname}`);
  }
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
    return json;
  } catch (error: any) {
    console.error("LLM JSON validation failed:", error);
    throw new Error("Invalid JSON format from model output.");
  }
}

