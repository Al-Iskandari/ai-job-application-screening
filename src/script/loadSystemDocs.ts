// scripts/loadSystemDocs.ts
import fs from "fs";
import { getEmbedding } from "../services/geminiClient";
import { insertZilliz, ensureCollection } from "../services/zillizClient";
import { uploadToFirebase, saveSystemDocMeta } from "../services/firebase";
import { extractTextFromPdfBuffer } from "../utils/pdf";
import path from "path";

const COLLECTION_NAME = "system_docs";

async function loadDocument(filePath: string, docType: string, title: string) {
  let text = "";
  if (filePath.endsWith(".pdf")) {
    const dataBuffer = fs.readFileSync(filePath);
    text = await extractTextFromPdfBuffer(dataBuffer);
  } else if (filePath.endsWith(".txt")) {
    text = fs.readFileSync(filePath, "utf-8");
  } else {
    throw new Error(`Unsupported file type: ${filePath}`);
  }

  console.log(`📄 Processing ${title} (${docType})`);

  // Chunk text if too long
  const chunks = text.match(/.{1,1500}/gs) || [];

  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    await insertZilliz(embedding, docType, title, chunk);
  }
}

async function main() {
  await ensureCollection("system_docs");

  // Define your system docs
  const systemDocs = [
    { file: "data/job_description.pdf", type: "job_description", title: "Job Description" },
    { file: "data/case_study.pdf", type: "case_study", title: "Case Study Brief" },
    { file: "data/rubric_cv.pdf", type: "rubric_cv", title: "CV Scoring Rubric" },
    { file: "data/rubric_project.pdf", type: "rubric_project", title: "Project Report Scoring Rubric" },
  ];

  for (const doc of systemDocs) {
    //Load system docs to Zilliz
    const filePath = path.resolve(__dirname, "./public", doc.file);
    await loadDocument(filePath, doc.type, doc.title);

    //Upload system docs to Firebase
    const dest = `system_docs/${doc.type}-${Date.now()}.pdf`;
    const fileBuffer = filePath.endsWith(".pdf") ? fs.readFileSync(filePath) : filePath.endsWith(".txt") ? fs.readFileSync(filePath, "utf-8") : fs.readFileSync(filePath);
    const file ={
      buffer: fileBuffer,
      originalname: filePath.replace("/data/", ""),
      mimetype: filePath.endsWith(".pdf") ? "application/pdf" : "text/plain",
      size: Buffer.byteLength(fileBuffer),
      encoding: filePath.endsWith(".pdf") ? "binary" : "utf-8",
      fieldname: "file",
      path: filePath,
      stream: fs.createReadStream(filePath),
      destination: dest,
      filename: filePath.replace("/data/", ""),
    }
    
    const url = await uploadToFirebase(doc.type, file as Express.Multer.File, dest);

    //Save metadata to firebase
    await saveSystemDocMeta(doc.type, doc.title, url);

  }

  console.log("✅ All system documents loaded into Zilliz.");
}

main().catch((err) => {
  console.error("❌ Error loading system documents:", err);
});
