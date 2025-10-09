import { config } from "@/config/index.js";
import { STAGES, setStage } from "@/utils/PipelineStagesHandler.js";


const { DEFAULT_STAGE_RETRIES, DEFAULT_STAGE_BASE_DELAY_MS, DEFAULT_STAGE_TIMEOUT_MS } = config;
/**
 * Sleep helper
 */
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Exponential backoff delay
 */
function backoffDelay(baseMs: number, attempt: number) {
  // jittered exponential backoff: base * 2^(attempt-1) + small jitter
  const jitter = Math.floor(Math.random() * 500);
  return baseMs * Math.pow(2, attempt - 1) + jitter;
}

/**
 * Timeout wrapper: rejects if the provided promise doesn't settle within ms
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label ?? "operation"} timed out after ${ms} ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Retry wrapper for a stage. Runs fn(), retries on throw until attempts exhausted.
 * Returns the result or throws final error.
 */
async function retryStage<T>(
  jobId: string,
  stageIndex: number,
  fn: () => Promise<T>,
  attempts = DEFAULT_STAGE_RETRIES,
  baseDelayMs = DEFAULT_STAGE_BASE_DELAY_MS,
  timeoutMs = DEFAULT_STAGE_TIMEOUT_MS
): Promise<T> {
  const stageName = STAGES[stageIndex].name;
  let lastError: any;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // update status to processing for this stage
      await setStage(jobId, stageIndex, "processing");
      
      // run fn with timeout
      const result = await withTimeout(fn(), timeoutMs, stageName);
      // success: mark done and return
     await setStage(jobId, stageIndex, "done");
      
      return result;
    } catch (err: any) {
      lastError = err;
      // If not last attempt, wait backoff and retry
      if (attempt < attempts) {
        const delay = backoffDelay(baseDelayMs, attempt);
        
        await sleep(delay);
      } else {
        // exhausted attempts
        // mark as failed (but do not throw here; caller will decide fallback vs hard fail)
        await setStage(jobId, stageIndex, "failed", String(lastError?.message || lastError));
        throw new Error(lastError?.message || lastError);
      }
    }
  }
  // Shouldn't reach here
  throw lastError;
}

export { sleep, backoffDelay, withTimeout, retryStage };