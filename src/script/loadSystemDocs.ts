// scripts/loadSystemDocs.ts
import { readFile } from 'node:fs/promises';
import { getEmbedding } from "@/services/geminiClient.js";
import { insertZilliz, ensureCollection } from "@/services/zillizClient.js";
import { uploadToSupabase, saveSystemDocMeta } from "@/services/supabase.js";
import { extractTextFromPdfBuffer } from "@/utils/pdf.js";
import path,{ dirname } from "path";
import { fileURLToPath } from "url";
import { createReadStream } from 'node:fs';
import { FloatVector } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = "system_docs";

async function loadDocument(filePath: string, docType: string, title: string) {
  try {
    let text = "";
    if (filePath.endsWith(".pdf")) {
      const dataBuffer = await readFile(filePath);
      text = await extractTextFromPdfBuffer(dataBuffer);
    } else if (filePath.endsWith(".txt")) {
      text = await readFile(filePath, "utf-8");
    } else {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    console.log(`📄 Processing ${title} (${docType})`);

    // Chunk text if too long
    const chunks = text.match(/.{1,1500}/gs) || [];

    for (const chunk of chunks) {
      const embeddingResult= await getEmbedding(chunk);
      await insertZilliz(embeddingResult, docType, title, chunk);
    }
    console.log(`✅ Loaded ${title} into Zilliz with ${chunks.length} chunks.`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }


}

async function main() {
  //await ensureCollection("system_docs");

  // Define your system docs
  const systemDocs = [
    { file: "data/job_description.pdf", type: "job_description", title: "Job Description" },
    { file: "data/case_study.pdf", type: "case_study", title: "Case Study Brief" },
    { file: "data/rubric_cv.pdf", type: "rubric_cv", title: "CV Scoring Rubric" },
    { file: "data/rubric_project.pdf", type: "rubric_project", title: "Project Report Scoring Rubric" },
  ];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  for (const doc of systemDocs) {
    //Load system docs to Zilliz
    const filePath = path.resolve(__dirname, "../../public", doc.file);
    await loadDocument(filePath, doc.type, doc.title);

    //Upload system docs to Firebase
    const dest = `system_docs/${doc.type}-${Date.now()}.pdf`;
    const fileBuffer = filePath.endsWith(".pdf") ? await readFile(filePath) : filePath.endsWith(".txt") ? await readFile(filePath, "utf-8") : await readFile(filePath);
    const file ={
      buffer: fileBuffer,
      originalname: filePath.replace("/data/", ""),
      mimetype: filePath.endsWith(".pdf") ? "application/pdf" : "text/plain",
      size: Buffer.byteLength(fileBuffer),
      encoding: filePath.endsWith(".pdf") ? "binary" : "utf-8",
      fieldname: "file",
      path: filePath,
      stream: createReadStream(filePath),
      destination: dest,
      filename: filePath.replace("/data/", ""),
    }

    const url = await uploadToSupabase(doc.type, file as Express.Multer.File, dest);

    //Save metadata to supabase
    await saveSystemDocMeta(doc.type, doc.title, dest);

  }

  console.log("✅ All system documents loaded into Zilliz.");
}

main().catch((err) => {
  console.error("❌ Error loading system documents:", err);
});
