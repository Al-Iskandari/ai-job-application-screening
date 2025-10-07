import { updateEvaluationStatus } from "../services/firebase";
type StageName =
  | "Download files and extract text"
  | "Parse text from PDF buffers"
  | "Generate embeddings"
  | "Retrieve context from Zilliz"
  | "Call Gemini for CV evaluation"
  | "Call Gemini for Project evaluation"
  | "Summarize evaluation"
  | "Combine evaluations"
  | "Sanitize Gemini response"
  | "Save evaluation to Firestore";

const STAGES: { name: StageName; progress: number }[] = [
  { name: "Download files and extract text", progress: 10 },
  { name: "Parse text from PDF buffers", progress: 20 },
  { name: "Generate embeddings", progress: 30 },
  { name: "Retrieve context from Zilliz", progress: 40 },
  { name: "Call Gemini for CV evaluation", progress: 55 },
  { name: "Call Gemini for Project evaluation", progress: 70 },
  { name: "Summarize evaluation", progress: 80 },
  { name: "Combine evaluations", progress: 90 },
  { name: "Sanitize Gemini response", progress: 95 },
  { name: "Save evaluation to Firestore", progress: 100 },
];

// Per-stage tuning (you can tune per-stage attempts and timeout)
const STAGE_CONFIG: Partial<
  Record<
    StageName,
    {
      attempts?: number;
      baseDelayMs?: number;
      timeoutMs?: number;
      fallback?: boolean; // if true, pipeline can continue with fallback if stage ultimately fails
    }
  >
> = {
  "Download files and extract text": { attempts: 2, baseDelayMs: 1000, timeoutMs: 30_000, fallback: false },
  "Parse text from PDF buffers": { attempts: 2, baseDelayMs: 1000, timeoutMs: 30_000, fallback: false },
  "Generate embeddings": { attempts: 3, baseDelayMs: 2000, timeoutMs: 60_000, fallback: false },
  "Retrieve context from Zilliz": { attempts: 3, baseDelayMs: 2000, timeoutMs: 45_000, fallback: false },
  "Call Gemini for CV evaluation": { attempts: 3, baseDelayMs: 3000, timeoutMs: 90_000, fallback: false },
  "Call Gemini for Project evaluation": { attempts: 3, baseDelayMs: 3000, timeoutMs: 90_000, fallback: false },
  "Summarize evaluation": { attempts: 2, baseDelayMs: 2000, timeoutMs: 60_000, fallback: true }, // fallback allowed
  "Combine evaluations": { attempts: 2, baseDelayMs: 1000, timeoutMs: 30_000, fallback: false },
  "Sanitize Gemini response": { attempts: 2, baseDelayMs: 1000, timeoutMs: 15_000, fallback: false },
  "Save evaluation to Firestore": { attempts: 3, baseDelayMs: 1000, timeoutMs: 15_000, fallback: false },
};

/**
 * Utility to update the Firestore job doc
 */
async function setStage(jobId: string, stageIndex: number, status: "running" | "done" | "failed", error?: string) {
  const stage = STAGES[stageIndex];
  const update: any = {
    stage: stage.name,
    progress: stage.progress,
    status: status === "failed" ? "failed" : "processing",
    updatedAt: new Date().toISOString(),
  };
  if (error) update.error = error;
  await updateEvaluationStatus(jobId, update);
}

export { STAGES, STAGE_CONFIG, setStage, StageName };

