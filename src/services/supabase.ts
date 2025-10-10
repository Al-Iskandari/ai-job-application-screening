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

    if (uploadError) {
      if (uploadError.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_UPLOAD_FAILED");
    }

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

    if (error || !data) {
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    }
    
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

  if (insertError || !data) {
    if (insertError?.message.toLowerCase().includes("limit")) {
      throw new Error("SUPABASE_QUOTA_EXCEEDED");
    }
    throw new Error("SUPABASE_DOWNLOAD_FAILED");
  }

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

    if (error) {
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    }
    return {"message": `File metadata updated successfully for candidate ${candidateId}`};
  } catch (error) {
    console.error("Error updating file metadata:", error);
    throw error;
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

  if (error || !data) {
    if (error?.message.toLowerCase().includes("limit")) {
      throw new Error("SUPABASE_QUOTA_EXCEEDED");
    }
    throw new Error("SUPABASE_DOWNLOAD_FAILED");
  }

  return { data: data || null, error };
}
/** Get all candidates
 */
export async function getAllCandidates(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .order('created_at', { ascending: false });

    if (error) {
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    } 
    
    return data;  
  } catch (error) {
    throw error;
  }
}

/**
 * Save evaluation result
 */
export async function saveResult(record : any): Promise<string> {
  try {
    const { error } = await supabase
      .from("evaluations")
      .upsert(record, { onConflict: "candidate_id" });

    if (error){
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    }
    return record.candidate_id;
  } catch (error) {
    throw error;
  }
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

    if (error) {
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    }

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
  try {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .eq("candidate_id", userId)
      .single();

    if (error && error.code !== "PGRST116"){
      if (error?.message.toLowerCase().includes("limit")) {
        throw new Error("SUPABASE_QUOTA_EXCEEDED");
      }
      throw new Error("SUPABASE_DOWNLOAD_FAILED");
    }

    return { data: data || null, error}

  }catch (error) {
    throw error;
  }
}

/**
 * Save system document metadata (system_docs_meta table)
 */
export async function saveSystemDocMeta(
  type: string,
  title: string,
  path: string,
) {
  try {
  const { error } = await supabase.from("system_docs_meta").insert({
    doc_type: type,
    title,
    path,
    last_updated: new Date().toISOString(),
  });

  if (error) {
    if (error?.message.toLowerCase().includes("limit")) {
      throw new Error("SUPABASE_QUOTA_EXCEEDED");
    }
    throw new Error("SUPABASE_DOWNLOAD_FAILED");
  }

  return { success: true, message: "System document metadata saved successfully." };
  } catch (error) {
    throw error;
  }
}
