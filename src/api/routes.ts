import express from 'express';
import multer from 'multer';
import { googleAuth, AuthRequest } from './middleware';
import { db, bucket, generateSignedUploadUrl, addCandidate, saveFileMetadata, updateEvaluationStatus, getResult } from '../services/firebase';
import { evaluationQueue } from '../services/queue';
import { validatePdfBuffer } from '../utils/validators';
import { evaluateDocuments } from '../services/evaluator';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes } });

/**
 * POST /api/upload
 * generate signed URLs for upload for backend minimum bandwidth
 * multipart form-data with cv and report files
 */
router.post('/upload', googleAuth, upload.fields([{ name: 'cv' }, { name: 'report' }]), async (req: AuthRequest, res) => {
  try {

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.cv || !files.report) {
      return res.status(400).json({ error: 'cv and report files are required' });
    }

    

    const cv = files.cv[0];
    const report = files.report[0];

    // basic validation
    if (!validatePdfBuffer(cv.buffer) || !validatePdfBuffer(report.buffer)) {
      return res.status(400).json({ error: 'Uploaded files must be PDFs' });
    }

  
    const candidateId = uuidv4();

    for (const fileType of ["cv", "project"]) {
      const file = files[fileType]?.[0];
      if (!file) continue;

      const dest = `candidates/${candidateId}/${file.originalname}-${Date.now()}.pdf`;
      const url = await generateSignedUploadUrl(dest, file.mimetype);

      await addCandidate(candidateId || 'anonymous', dest, '', url, '');

      return {
        signedUrl: url,
        storagePath: dest,
        candidateId,
      };
    }
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
    const { storagePath, candidateId, fileType } = req.body;

    saveFileMetadata(candidateId, fileType, storagePath);

    res.json({ success: true, message: "Upload verified and metadata set." });
  } catch (err) {
    console.error("Error confirming upload:", err);
    res.status(500).json({ error: "Failed to confirm upload" });
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

    const doc = await db.collection('candidates').doc(candidateId).get();
    if (!doc.exists) return res.status(404).json({ error: 'candidate not found' });
    const data = doc.data();

    if (runNow) {
      // optional synchronous (not recommended for very long jobs)
      await updateEvaluationStatus(candidateId, 'evaluating');
      // attempt to run evaluation code inline once
      await evaluateDocuments({ candidateId, cvPath: data!.cvPath, projectPath: data!.reportPath, cvUrl: data!.cvUrl, projectUrl: data!.projectUrl})
        .then(() => console.log('runNow completed for', candidateId))
        .catch((e: any) => console.error('runNow error', e));
      return res.json({ message: 'Triggered immediate evaluation (running in background)' });
    } else {
      // enqueue normally
      await evaluationQueue.add(config.queueName, { candidateId, cvPath: data!.cvPath, projectPath: data!.reportPath, cvUrl: data!.cvUrl, projectUrl: data!.projectUrl }, { attempts: 3 });
      await updateEvaluationStatus(candidateId, 'queued');
      return res.json({ message: 'Re-evaluation queued' });
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
    const snap = await getResult(userId);
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    return res.json(snap.data());
  } catch (err) {
    console.error('result endpoint error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
