// services/evaluationService.ts
import { getEmbedding, runGeminiChain, geminiSummarize } from "../services/geminiClient";
import { queryZilliz } from "../services/zillizClient";
import { downloadFileToBuffer, updateEvaluationStatus, saveResult } from "./firebase";
import { extractTextFromPdfBuffer } from "../utils/pdf";

//Payload interface for job data
interface Payload {
  candidateId: string;
  cvPath: string;
  projectPath: string;
  cvUrl: string;
  projectUrl: string;
}

const STAGES = [
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

// Helper function to streamline evaluation status
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

// Main evaluation function
export async function evaluateDocuments({ candidateId, cvPath, projectPath, cvUrl, projectUrl }: Payload) {

  try {

    // 1. Download files and extract text
    await setStage(candidateId, 0, "running");
    const cvBuffer = await downloadFileToBuffer(cvPath);
    const projectBuffer = await downloadFileToBuffer(projectPath);
    await setStage(candidateId, 0, "done");

    // 2. Parse text from PDF buffers
    await setStage(candidateId, 1, "running");
    const cvText = await extractTextFromPdfBuffer(cvBuffer);
    const projectText = await extractTextFromPdfBuffer(projectBuffer);
    await setStage(candidateId, 1, "done");

    // 3. Embeddings
    await setStage(candidateId, 2, "running");
    const cvEmbedding = await getEmbedding(cvText);
    const projectEmbedding = await getEmbedding(projectText);
    await setStage(candidateId, 2, "done");

    // 4. Retrieve context from Zilliz
    await setStage(candidateId, 3, "running");
    const jobDescDocs = await queryZilliz(cvEmbedding, ["job_description"]);
    const rubricCvDocs = await queryZilliz(cvEmbedding, ["rubric_cv"]);
    const caseStudyDocs = await queryZilliz(projectEmbedding, ["case_study"]);
    const rubricProjectDocs = await queryZilliz(projectEmbedding, ["rubric_project"]);
    await setStage(candidateId, 3, "done");

    // 5. Call Gemini for cv evaluation
    await setStage(candidateId, 4, "running");
    const cvEvaluation = await runGeminiChain({
      type: "cv",
      text: cvText,
      relevantDocs: jobDescDocs.join("\n---\n"),
      rubricDocs: rubricCvDocs.join("\n---\n"),
    });
    await setStage(candidateId, 4, "done");

    // 6. Call Gemini for project evaluation
    await setStage(candidateId, 5, "running");
    const projectEvaluation = await runGeminiChain({
      type: "project",
      text: projectText,
      relevantDocs: caseStudyDocs.join("\n---\n"),
      rubricDocs: rubricProjectDocs.join("\n---\n"),
    });
    await setStage(candidateId, 5, "done");

    // 7. Summarize evaluation
    await setStage(candidateId, 6, "running");
    const summary = await geminiSummarize(cvEvaluation, projectEvaluation);
    await setStage(candidateId, 6, "done");

    // 8. Combine evaluations
    await setStage(candidateId, 7, "running");
    const combinedEvaluation = {
      ...cvEvaluation,
      ...projectEvaluation,
      ...summary,
    };
    await setStage(candidateId, 7, "done");

    // 9. Sanitize gemini response
    await setStage(candidateId, 8, "running");
    const sanitizedEvaluation = JSON.parse(combinedEvaluation);
    sanitizedEvaluation.cv_match_rate = Math.round(Math.min(Math.max(sanitizedEvaluation.cv_match_rate, 0), 1) * 100);
    sanitizedEvaluation.cv_feedback = sanitizedEvaluation.cv_feedback.trim();
    sanitizedEvaluation.project_score = Math.round(Math.min(Math.max(sanitizedEvaluation.project_score, 1), 5) * 100);
    sanitizedEvaluation.project_feedback = sanitizedEvaluation.project_feedback.trim();
    sanitizedEvaluation.overall_summary = sanitizedEvaluation.overall_summary.trim();
    await setStage(candidateId, 8, "done");

    // 10. Save evaluation to firestore
    await setStage(candidateId, 9, "running");
    const resultId = await saveResult(sanitizedEvaluation, candidateId, { cvUrl: cvUrl, projectUrl: projectUrl });
    await setStage(candidateId, 9, "done");

    // 11. Return evaluation
    return { resultId, evaluation: sanitizedEvaluation };
  } catch (error) {
    console.error("Evaluation error:", error);
    throw error;
  }

}
