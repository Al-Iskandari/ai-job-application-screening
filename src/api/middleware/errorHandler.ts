import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("Error caught by middleware:", err);

  let status = 500;
  let message = "Internal server error";

  // Normalize error code/message
  const code = err.code || err.name || "";
  const msg = (err.message || "").toLowerCase();

  switch (true) {
    // === FILE UPLOAD ERRORS ===
    case msg.includes("no file uploaded") || code === "NO_FILE_UPLOADED":
      status = 400;
      message = "No file uploaded. Please attach a PDF file.";
      break;

    case msg.includes("empty file") || code === "EMPTY_FILE":
      status = 400;
      message = "Uploaded file is empty (0 bytes). Please check your file.";
      break;

    case msg.includes("invalid file type") || code === "INVALID_FILE_TYPE":
      status = 400;
      message = "Invalid file type. Only PDF files are supported.";
      break;

    case msg.includes("file too large") || code === "LIMIT_FILE_SIZE":
      status = 413;
      message = "File too large. Maximum 10 MB allowed.";
      break;

    case msg.includes("pdf parse") || code === "PDF_PARSE_ERROR":
      status = 422;
      message = "Failed to parse PDF — it may be corrupted or image-based.";
      break;

    // === SUPABASE ERRORS ===
    case msg.includes("supabase upload failed"):
      status = 502;
      message = "Supabase upload failed. Please try again later.";
      break;

    case msg.includes("supabase download failed"):
      status = 502;
      message = "Unable to download file from Supabase. Please retry later.";
      break;

    case msg.includes("quota") || msg.includes("rate limit exceeded"):
      status = 429;
      message = "Supabase API quota limit reached. Please wait before retrying.";
      break;

    // === ZILLIZ / VECTOR DB ERRORS ===
    case msg.includes("zilliz") && msg.includes("quota"):
      status = 429;
      message = "Zilliz API quota limit reached. Try again later or upgrade your plan.";
      break;

    case msg.includes("zilliz connection failed"):
      status = 503;
      message = "Zilliz service is currently unreachable.";
      break;

    // === GEMINI / LLM ERRORS ===
    case msg.includes("gemini") && msg.includes("timeout"):
      status = 504;
      message = "Gemini model request timed out. Please retry.";
      break;

    case msg.includes("gemini") && msg.includes("unavailable"):
      status = 503;
      message = "Gemini API is temporarily unavailable.";
      break;

    case msg.includes("quota") || msg.includes("rate limit"):
      status = 429;
      message = "Gemini API quota or rate limit exceeded. Please try again later.";
      break;

    // === NETWORK / UNKNOWN ERRORS ===
    case msg.includes("network"):
      status = 503;
      message = "Network error. Please check your connection.";
      break;

    default:
      message = err.message || message;
  }

  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}
