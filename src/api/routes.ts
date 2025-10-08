import express from 'express';
import multer from 'multer';
import { googleAuth, AuthRequest } from '@/api/middleware.js';
import { generateSignedUploadUrl, getCandidateData, saveFileMetadata, updateEvaluationStatus, getResult, updateFileMetadata } from '@/services/supabase.js';
import { evaluationQueue } from '@/services/queue.js';
import { evaluateDocuments } from '@/services/evaluator.js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config/index.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes } });


/**
 * POST /api/upload
 * generate signed URLs for upload for backend minimum bandwidth
 * multipart form-data with cv and report files
 */
router.post('/upload', googleAuth, async (req: AuthRequest, res) => {
  try {

    const { fileName, fileType, candidateId } = req.body;

    // Reuse candidate if provided
    const id = candidateId || uuidv4(); // Automatically generate candidateId if not provided
    const dest = `candidate/${id}/${fileName}-${Date.now()}.pdf`;

    const url = await generateSignedUploadUrl(dest, fileType);

    return res.json({
      signedUrl: url,
      storagePath: dest,
      candidateId: id,
    });
    
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/confirm-upload
 * body: { storagePath, candidateId, fileType } -> confirm upload
 */

router.post("/confirm-upload", async (req, res) => {
  try {
    const { candidateId, storagePath, fileCategory } = req.body;
    if (!candidateId || !storagePath || !fileCategory)
      return res.status(400).json({ success: false, message: "Missing fields" });

    // Determine field to update
    const updateData: any = { updated_at: new Date().toISOString() };
    if (fileCategory === "cv") updateData.cv_path = storagePath;
    else if (fileCategory === "project") updateData.project_path = storagePath;

    // Check if candidate exists
    const { data: existing, error: selectError } : any = await getCandidateData(candidateId);

    if (selectError && selectError.code !== "PGRST116") {
      throw selectError;
    }

    if (existing) {
      // ✅ Update existing record
      const result = await updateFileMetadata(candidateId, updateData);

      return res.json({
        success: true,
        message: result.message,
      });
    } else {
      // ✅ Insert new record
      const result = await saveFileMetadata(candidateId, updateData, fileCategory, storagePath);

      return res.json({
        success: true,
        message: result.message,
      });
      
    }
  } catch (err: any) {
    console.error("Confirm-upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/evaluate
 * body: { candidateId } -> trigger re-evaluation (enqueue or run immediately)
 */
router.post('/evaluate', googleAuth, express.json(), async (req: AuthRequest, res) => {
  try {
    const { jobTitle, candidateId, runNow } = req.body;
    if (!candidateId) return res.status(400).json({ error: 'candidateId is required' });

    const { data: docs, error: selectError } = await getCandidateData(candidateId);
    if (selectError) return res.status(404).json({ error: `Candidate ${candidateId} not found` });

    const cvPath = docs.cv_path
    const reportPath = docs.project_path;
    if (!cvPath || !reportPath) return res.status(400).json({ error: 'cv or project report missing for candidate' });

    const update = {
        stage: 'queued',
        progress: 0,
        status: 'queued',
        updated_at: new Date().toISOString(),
      }

    if (runNow) {
      // optional synchronous (not recommended for very long jobs)
      await updateEvaluationStatus(candidateId, update);
      // attempt to run evaluation code inline once
      await evaluateDocuments({ candidateId, cvPath: cvPath, projectPath: reportPath })
        .then(() => console.log('runNow completed for', candidateId))
        .catch((e: any) => console.error('runNow error', e));
      return res.json({ candidateId, message: 'Triggered immediate evaluation (running in background)' });
    } else {
      // enqueue normally
      await evaluationQueue.add(config.queueName, { candidateId, cvPath: cvPath, projectPath: reportPath }, { attempts: 3 });
      
      // update evaluation status on firestore
      await updateEvaluationStatus(candidateId, update);

      return res.json({ candidateId, message: 'Re-evaluation queued' });
    }
  } catch (err) {
    console.error('evaluate endpoint error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/result/:id
 * Returns the evaluation db doc
 */
router.get('/result/:id', googleAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.id;
    const {data: existing, error: selectError} = await getResult(userId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    return res.json(existing);
  } catch (err) {
    console.error('result endpoint error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/** GET /api/config/google-client-id
 * Returns the Google OAuth Client ID for frontend use
 */
router.get("/google-client-id", (req, res) => {
  res.json({ client_id: config.googleOauthClientId });
});


export default router;
