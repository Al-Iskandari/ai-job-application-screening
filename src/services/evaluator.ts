// services/evaluationService.ts
import { getEmbedding, runGeminiChain, geminiSummarize } from "../services/geminiClient";
import { queryZilliz } from "../services/zillizClient";
import { downloadFileToBuffer, saveResult } from "./firebase";
import { extractTextFromPdfBuffer } from "../utils/pdf";

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

  try {
    // 1. Download files and extract text
    const cvBuffer = await downloadFileToBuffer(cvPath);
    const projectBuffer = await downloadFileToBuffer(projectPath);

    // 2. Parse text from PDF buffers
    const cvText = await extractTextFromPdfBuffer(cvBuffer);
    const projectText = await extractTextFromPdfBuffer(projectBuffer);

    // 3. Embeddings
    const cvEmbedding = await getEmbedding(cvText);
    const projectEmbedding = await getEmbedding(projectText);

    // 4. Retrieve context from Zilliz
    const jobDescDocs = await queryZilliz(cvEmbedding, ["job_description"]);
    const rubricCvDocs = await queryZilliz(cvEmbedding, ["rubric_cv"]);
    const caseStudyDocs = await queryZilliz(projectEmbedding, ["case_study"]);
    const rubricProjectDocs = await queryZilliz(projectEmbedding, ["rubric_project"]);


    // 5. Call Gemini for cv evaluation
    const cvEvaluation = await runGeminiChain({
      type: "cv",
      text: cvText,
      relevantDocs: jobDescDocs.join("\n---\n"),
      rubricDocs: rubricCvDocs.join("\n---\n"),
    });

    // 6. Call Gemini for project evaluation
    const projectEvaluation = await runGeminiChain({
      type: "project",
      text: projectText,
      relevantDocs: caseStudyDocs.join("\n---\n"),
      rubricDocs: rubricProjectDocs.join("\n---\n"),
    });

    // 7. Summarize evaluation
    const summary = await geminiSummarize(cvEvaluation, projectEvaluation);
      

    // 7. Combine evaluations
    const combinedEvaluation = {
      ...cvEvaluation,
      ...projectEvaluation,
      ...summary,
    };

    // 7. Sanitize gemini response
    const sanitizedEvaluation = JSON.parse(combinedEvaluation);
    sanitizedEvaluation.cv_match_rate = Math.round(Math.min(Math.max(sanitizedEvaluation.cv_match_rate, 0), 1) * 100);
    sanitizedEvaluation.cv_feedback = sanitizedEvaluation.cv_feedback.trim();
    sanitizedEvaluation.project_score = Math.round(Math.min(Math.max(sanitizedEvaluation.project_score, 1), 5) * 100);
    sanitizedEvaluation.project_feedback = sanitizedEvaluation.project_feedback.trim();
    sanitizedEvaluation.overall_summary = sanitizedEvaluation.overall_summary.trim();

    // 8. Save to evaluation to firestore
    const resultId = await saveResult(sanitizedEvaluation, candidateId, { cvUrl: cvUrl, projectUrl: projectUrl });
    return { resultId, evaluation: sanitizedEvaluation };
  } catch (error) {
    console.error("Evaluation error:", error);
    throw error;
  }

}
