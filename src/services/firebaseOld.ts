// services/firebaseService.ts
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { config } from "@/config/index.js";

const serviceAccount = path.resolve(config.firebaseServiceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccount, "utf8"))),
    storageBucket: config.firebaseStorageBucket,
  });
}

export const bucket = getStorage().bucket();
export const db = getFirestore();

// 🔹 Upload file to Firebase Storage
export async function uploadToFirebase(id: string, file: Express.Multer.File,  dest: string): Promise<string> {
  try {
  // metadata for public access
  const metadata = {
    metadata: { firebaseStorageDownloadTokens: id },
    contentType: file.mimetype,
  };

  // upload to Firebase Storage
  const fileRef = bucket.file(dest);
  await fileRef.save(file.buffer, { metadata });

  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: '03-01-2500', // long expiry
  });

  fs.unlinkSync(file.path); // remove local file

  return url;
  } catch (error) {
    throw error;
  }
}

// Save file metadata (upload path, candidate info)
export async function saveFileMetadata(candidateId: string, fileType: string, filePath: string) {
  const data = {
    candidateId,
    fileType,
    filePath,
    uploadedAt: new Date().toISOString(),
  };
  await db.collection("uploads").add(data);
  return data;
}

// Generate signed URL for direct browser upload
export async function generateSignedUploadUrl(filePath: string, contentType: string) {
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 24 * 60 * 1000, // 1 min validity
    contentType,
  });

  return url;
}

// 🔹 Add candidate record in Firestore for future usage
export async function addCandidate(userId: string, cvPath: string, projectPath: string, cvUrl: string, projectUrl: string): Promise<string> {
  try{
    const docRef = db.collection("candidates").doc(userId);

    const record = {
      userId,
      cvPath,
      projectPath,
      cvUrl,
      projectUrl,
      status: "uploaded",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await docRef.set(record);
    return userId;
  } catch (error) {
    throw error;
  }
}

// 🔹 Get candidate record by ID
export async function getCandidate(userId: string): Promise<any | null> {
  const doc = await db.collection("candidates").doc(userId).get();
  return doc.exists ? doc.data() : null;
}
// 🔹 Download file from Firebase Storage to Buffer
export async function downloadFileToBuffer(remotePath: string): Promise<Buffer> {
  try {
    const file = bucket.file(remotePath);
    const [exists] = await file.exists();
    if (!exists) throw new Error('Storage file not found: ' + remotePath);
    const [buf] = await file.download();
    return buf;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// 🔹 Save evaluation result in Firestore
export async function saveResult(evaluation: any, userId: string, meta?: any): Promise<string> {
 const docRef = db.collection("evaluations").doc(userId);

  const record = {
    userId: userId || "anonymous",
    stage: "completed",
    status: "completed",
    progress: 100,
    result: evaluation,
    cvUrl: meta?.cvUrl || "",
    projectUrl: meta?.projectUrl || "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await docRef.set(record);
  return userId;
}

// 🔹 Update job status
export async function updateEvaluationStatus(userId: string, update: any) {
  const ref = db.collection("evaluations").doc(userId);
  await ref.update(update);
}

// 🔹 Get result by ID
export async function getResult(userId: string): Promise<any | null> {
  const doc = await db.collection("evaluations").doc(userId).get();
  return doc.exists ? doc.data() : null;
}

// 🔹 Save system document metadata (optional)
export async function saveSystemDocMeta(type: string, title: string, url: string, version = "v1.0") {
  await db.collection("systemDocs").add({
    type,
    title,
    version,
    sourceFileUrl: url,
    lastUpdated: new Date(),
  });
}
