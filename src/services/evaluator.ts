// services/evaluationService.ts
import { getEmbedding, runGeminiChain, geminiSummarize } from "../services/geminiClient";
import { queryZilliz } from "../services/zillizClient";
import { downloadFileToBuffer, updateEvaluationStatus, saveResult } from "./firebase";
import { extractTextFromPdfBuffer } from "../utils/pdf";
import { setStage,STAGES, STAGE_CONFIG } from "../utils/PipelineStagesHandler";
import { config } from "../config";
import { retryStage } from "../utils/errorHandler";

const { DEFAULT_STAGE_RETRIES, DEFAULT_STAGE_BASE_DELAY_MS, DEFAULT_STAGE_TIMEOUT_MS } = config;

//Payload interface for job data
interface Payload {
  candidateId: string;
  cvPath: string;
  projectPath: string;
  cvUrl: string;
  projectUrl: string;
}

// Main evaluation function
export async function evaluateDocuments({ candidateId, cvPath, projectPath, cvUrl, projectUrl }: Payload) {

  // local holders for intermediate outputs
  let downloaded: any = null;
  let parsed: any = null;
  let embeddings: any = null;
  let context: any = null;
  let cvResult: any = null;
  let projectResult: any = null;
  let summary: any = null;
  let combined: any = null;
  let sanitized: any = null;

  try {

    // 1. Download files and extract text
    const stage1Config = STAGE_CONFIG[STAGES[0].name] || {};
    downloaded = await retryStage(
      candidateId,
      0,
      async () => {
        const cvBuffer = await downloadFileToBuffer(cvPath);
        const projectBuffer = await downloadFileToBuffer(projectPath);
        return { cvBuffer, projectBuffer };
      },
      stage1Config.attempts || DEFAULT_STAGE_RETRIES,
      stage1Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage1Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 2. Parse text from PDF buffers
    const { cvBuffer, projectBuffer } = downloaded;
    const stage2Config = STAGE_CONFIG[STAGES[1].name] || {};
    parsed = await retryStage(
      candidateId,
      1,
      async () => {
        const cvText = await extractTextFromPdfBuffer(cvBuffer);
        const projectText = await extractTextFromPdfBuffer(projectBuffer);
        return { cvText, projectText };
      },
      stage2Config.attempts || DEFAULT_STAGE_RETRIES,
      stage2Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage2Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 3. Embeddings
    const { cvText, projectText } = parsed;
    const stage3Config = STAGE_CONFIG[STAGES[2].name] || {};
    embeddings = await retryStage(
      candidateId,
      2,
      async () => {
        const cvEmbedding = await getEmbedding(cvText);
        const projectEmbedding = await getEmbedding(projectText);
        return { cvEmbedding, projectEmbedding };
      },
      stage3Config.attempts || DEFAULT_STAGE_RETRIES,
      stage3Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage3Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 4. Retrieve context from Zilliz
    const { cvEmbedding, projectEmbedding } = embeddings;
    const stage4Config = STAGE_CONFIG[STAGES[3].name] || {};
    context = await retryStage(
      candidateId,
      3,
      async () => {
        const jobDescDocs = await queryZilliz(cvEmbedding, ["job_description"]);
        const rubricCvDocs = await queryZilliz(cvEmbedding, ["rubric_cv"]);
        const caseStudyDocs = await queryZilliz(projectEmbedding, ["case_study"]);
        const rubricProjectDocs = await queryZilliz(projectEmbedding, ["rubric_project"]);
        return { jobDescDocs, rubricCvDocs, caseStudyDocs, rubricProjectDocs };
      },
      stage4Config.attempts || DEFAULT_STAGE_RETRIES,
      stage4Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage4Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 5. Call Gemini for cv evaluation
    const { jobDescDocs, rubricCvDocs, caseStudyDocs, rubricProjectDocs } = context;
    const stage5Config = STAGE_CONFIG[STAGES[4].name] || {};
    cvResult = await retryStage(
      candidateId,
      4,
      async () => {
        return await runGeminiChain({
          type: "cv",
          text: cvText,
          relevantDocs: jobDescDocs.join("\n---\n"),
          rubricDocs: rubricCvDocs.join("\n---\n"),
        });
      },
      stage5Config.attempts || DEFAULT_STAGE_RETRIES,
      stage5Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage5Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 6. Call Gemini for project evaluation
    const stage6Config = STAGE_CONFIG[STAGES[5].name] || {};
    projectResult = await retryStage(
      candidateId,
      5,
      async () => {
        return await runGeminiChain({
          type: "project",
          text: projectText,
          relevantDocs: caseStudyDocs.join("\n---\n"),
          rubricDocs: rubricProjectDocs.join("\n---\n"),
        });
      },
      stage6Config.attempts || DEFAULT_STAGE_RETRIES,
      stage6Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage6Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 7. Summarize evaluation
    const { cvEvaluation } = cvResult;
    const { projectEvaluation } = projectResult;
    const stage7Config = STAGE_CONFIG[STAGES[6].name] || {};
    summary = await retryStage(
      candidateId,
      6,
      async () => {
        return await geminiSummarize(cvEvaluation, projectEvaluation);
      },
      stage7Config.attempts || DEFAULT_STAGE_RETRIES,
      stage7Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage7Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 8. Combine evaluations
    const stage8Config = STAGE_CONFIG[STAGES[7].name] || {};
    combined = await retryStage(
      candidateId,
      7,    
      async () => {
        return { ...cvEvaluation, ...projectEvaluation, ...summary };
      },
      stage8Config.attempts || DEFAULT_STAGE_RETRIES,
      stage8Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage8Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 9. Sanitize gemini response
    const { combinedEvaluation } = combined;
    const stage9Config = STAGE_CONFIG[STAGES[8].name] || {};
    sanitized = await retryStage(
      candidateId,
      8,
      async () => {
        const sanitized = JSON.parse(combinedEvaluation);
        sanitized.cv_match_rate = Math.round(Math.min(Math.max(sanitized.cv_match_rate, 0), 1) * 100);
        sanitized.cv_feedback = sanitized.cv_feedback.trim();
        sanitized.project_score = Math.round(Math.min(Math.max(sanitized.project_score, 1), 5) * 100);
        sanitized.project_feedback = sanitized.project_feedback.trim();
        sanitized.overall_summary = sanitized.overall_summary.trim();
        return sanitized;
      },
      stage9Config.attempts || DEFAULT_STAGE_RETRIES,
      stage9Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage9Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 10. Save evaluation to firestore
    const sanitizedEvaluation = sanitized;
    const stage10Config = STAGE_CONFIG[STAGES[9].name] || {};
    await retryStage(
      candidateId,
      9,
      async () => {
        await saveResult(sanitizedEvaluation, candidateId, { cvUrl: cvUrl, projectUrl: projectUrl });
      },
      stage10Config.attempts || DEFAULT_STAGE_RETRIES,
      stage10Config.baseDelayMs || DEFAULT_STAGE_BASE_DELAY_MS,
      stage10Config.timeoutMs || DEFAULT_STAGE_TIMEOUT_MS
    );

    // 11. Return evaluation
    return { candidateId, evaluation: sanitizedEvaluation };
  } catch (error) {
    console.error("Evaluation error:", error);
    throw error;
  }

}
