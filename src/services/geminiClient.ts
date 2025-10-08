import { GoogleGenAI } from "@google/genai";
import { config } from "@/config/index.js";
import { validateLLMJson } from "@/utils/validators.js";
import { FloatVector } from "@zilliz/milvus2-sdk-node";

if (!config.googleApiKey) {
  throw new Error("GOOGLE_API_KEY is not set");
}

const client = new GoogleGenAI({
  apiKey: config.googleApiKey,
});

interface ChainParameters {
  type: "cv" | "project";
  text: string;
  relevantDocs: string;
  rubricDocs: string;
}
// 🔹 Text Generation (Evaluation)
export async function runGeminiChain({ type, text, relevantDocs, rubricDocs }: ChainParameters) {

  const prompt =
    type === "cv"
      ? buildCVPrompt(relevantDocs, rubricDocs, text)
      : buildProjectPrompt(relevantDocs, rubricDocs, text);
  try {
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      }
    });
    
    const outputText = result.text;

    // Validate and parse LLM JSON output
    const json = validateLLMJson(outputText as string);

    if (type === "cv" && typeof json.cv_score !== "number") {
      throw new Error("Missing cv_score field in model output.");
    }
    if (type === "project" && typeof json.project_score !== "number") {
      throw new Error("Missing project_score field in model output.");
    }

    return json;
    
  } catch (error) {
    console.error("Error running Gemini Chain:", error);
    return "";
  }
}

// 🔹 Text Generation (Overall Summary)
export async function geminiSummarize(cvResult: any, projectResult: any) {
  const prompt = buildOverallSummaryPrompt(cvResult, projectResult);
  try {
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
      }
    });
    const outputText = result.text;
    // Validate and parse LLM JSON output
    const json = validateLLMJson(outputText as string);
    if (typeof json.overall_summary !== "string") {
      throw new Error("Missing overall_summary field in model output.");
    }
    return json;
  } catch (error) {
    console.error("Error running Gemini Summarization:", error);
    return "";
  }
}

// 🔹 Embeddings (RAG)
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const result = await client.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
      }
    });
    return result?.embeddings?.[0].values || [];
  } catch (error) {
    console.error("Error getting embedding:", error);
    return [];
  }
}

//build cv prompt
function buildCVPrompt(jobDescriptionContext: string, rubricContext: string, cvText: string) {
  return `
          You are an AI recruiter evaluating a candidate's CV against the job description and CV scoring rubric.

          ## Context:
          - Job Description:
          ${jobDescriptionContext}

          - CV Scoring Rubric:
          ${rubricContext}

          ## Candidate CV:
          ${cvText}

          ## Instructions:
          1. Evaluate the CV strictly according to the Job description and rubric criteria.
          2. Give cv_match_rate based on each rubric parameter weight and scoring guide.
          3. Each scoring guide is from 1 to 5 corresponding to candidate's CV and Job description relevance.
          4. cv_match_rate is a weighted average from 1 to 5, convert it to 0 to 1 and round it to 2 decimals.
          5. Provide detailed feedback explaining strengths, weaknesses, and improvement areas.
          6. Return the result **only in JSON** format below.

          ### Example JSON Output:
          {
            "result": {
              "cv_match_rate": 0.82,
              "cv_feedback": "Strong in backend and cloud, limited AI integration experience...",
              }
          }
          `;
}

//build project prompt
function buildProjectPrompt(caseStudyContext: string, rubricContext: string, projectText: string) {
  return `
          You are an AI evaluator reviewing a candidate's project report for a case study assignment.

          ## Context:
          - Case Study Brief:
          ${caseStudyContext}

          - Project Scoring Rubric:
          ${rubricContext}

          ## Candidate Project Report:
          ${projectText}

          ## Instructions:
          1. Assess the report strictly according to the case study brief and rubric criteria.
          2. Give project_score based on each rubric parameter weight and scoring guide.
          3. Each scoring guide is from 1 to 5 corresponding to how well the project meets the case study requirements.
          4. project_score is a weighted average from 1 to 5 and round it to 2 decimals.
          5. Provide detailed feedback explaining strengths, weaknesses, and improvement areas.
          6. Return the result **only in JSON** format below.

          ### Example JSON Output:
          {
            "result": {
              "project_score": 4.5,
              "project_feedback": "Meets prompt chaining requirements, lacks error handling robustness...",
              }
          }`;
}

// Build overall summary prompt
function buildOverallSummaryPrompt(cvResult: any, projectResult: any) {
  return `
          You are an AI summarizer creating an overall evaluation summary for a candidate based on their CV and project report.

          ## Context:
          - CV Evaluation:
          ${JSON.stringify(cvResult)}

          - Project Evaluation:
          ${JSON.stringify(projectResult)}

          ## Instructions:
          1. Synthesize the CV and project evaluations into a cohesive summary.
          2. Highlight key strengths and areas for improvement.
          3. Provide a summary in 3 to 5 sentences putting emphasis on strengths, gaps, recommendations.
          4. Return the result **only in JSON** format below.

          ## Example JSON Output:
          {
            "result": {
              "overall_summary": "Good candidate fit, would benefit from deeper RAG knowledge..."
            }
          }
          `;
}
