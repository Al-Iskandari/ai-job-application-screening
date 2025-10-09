import fs, { stat } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/config/index.js";

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

/**
 * Upload file buffer to Supabase Storage
 * and return a long-lived public URL (or signed URL if preferred)
 */
export async function uploadToSupabase(
  id: string,
  file: Express.Multer.File,
  dest: string
): Promise<string> {
  try {
    // Construct destination path in bucket
    const storagePath = path.join(dest, `${id}-${file.originalname}`);

    // Upload file buffer to Supabase bucket
    const { error: uploadError } = await supabase.storage
      .from("system_docs")
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Generate public or signed URL
    const { data: publicData } = supabase.storage
      .from("system_docs")
      .getPublicUrl(storagePath);

    // Optionally delete local temp file
    //if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);

    return publicData.publicUrl;
  } catch (error) {
    console.error("Error uploading to Supabase:", error);
    throw error;
  }
}

/**
 * Generate signed upload URL for direct browser upload
 */
export async function generateSignedUploadUrl(
  filePath: string,
  contentType: string
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("candidate")
      .createSignedUploadUrl(filePath, {
        upsert: true
      });

    if (error) throw error;

    return data.signedUrl;
  } catch (error) {
    const errorMessage = `Error generating signed URL: ${error instanceof Error ? error.message : String(error)}`;

    return Promise.reject(new Error(errorMessage));
  }
}

/**
 * Download a file from Supabase Storage into a Buffer
 */
export async function downloadFileToBuffer(remotePath: string): Promise<Buffer> {
  try {
    if(!remotePath) throw new Error('Storage file not found: ' + remotePath);

    const { data, error } = await supabase.storage
      .from("candidate")
      .download(remotePath);

    if (error) throw error;
    
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
}

/**
 * Save file metadata (upload path, candidate info)
 */
export async function saveFileMetadata(
  candidateId: string,
  updateData: any,
  fileCategory: string,
  storagePath: string
) {
  
  const data = {
      candidate_id: candidateId,
      ...updateData,
      [fileCategory === "cv" ? "cv_path" : "project_path"]: storagePath,
      created_at: new Date().toISOString(),
    };

  const { error: insertError } = await supabase.from("candidates").insert([data]);
  if (insertError) throw insertError;
  return {
    success: true,
    message: `Inserted new candidate ${candidateId} with ${fileCategory} file.`,
  };
}

/** Mark file as verified after successful upload
 */
export async function updateFileMetadata(candidateId: string, updateData: any): Promise<any> {
  try {
    const { error } = await supabase
      .from("candidates")
      .update(updateData)
      .eq("candidate_id", candidateId);

    if (error) throw error;
    return {"message": `File metadata updated successfully for candidate ${candidateId}`};
  } catch (error) {
    console.error("Error updating file metadata:", error);
    return Promise.reject(error);
  }
} 

/**
 * Get candidate record by ID
 */
export async function getCandidateData(userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("candidate_id", userId)
    .single();

  return { data: data || null, error };
}
/** Get all candidates
 */
export async function getAllCandidates(): Promise<any[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error.message);
    return [];
  } else {
    //console.log('Fetched data:', data);
    return data;
  }
}

/**
 * Save evaluation result
 */
export async function saveResult(record : any): Promise<string> {
  const { error } = await supabase
    .from("evaluations")
    .upsert(record, { onConflict: "candidate_id" });

  if (error) throw error;
  return record.candidate_id;
}

/**
 * Update evaluation status
 */
export async function updateEvaluationStatus(userId: string, update: any) {
  try{
    const { error } = await supabase
      .from("evaluations")
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", userId);

    if (error) throw error;
    return {status: 'success', "message": `Evaluation status updated successfully for candidate ${userId}`};
  } catch (error) {
    console.error("Error updating evaluation status:", error);
    throw error;
  }
}

/**
 * Get result by ID
 */
export async function getResult(userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("candidate_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return { data: data || null, error}
}

/**
 * Save system document metadata (system_docs_meta table)
 */
export async function saveSystemDocMeta(
  type: string,
  title: string,
  path: string,
) {
  const { error } = await supabase.from("system_docs_meta").insert({
    doc_type: type,
    title,
    path,
    last_updated: new Date().toISOString(),
  });

  if (error) throw error;
}
