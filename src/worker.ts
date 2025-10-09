/**
 * Worker process using bullmq to process evaluation jobs.
 * Run this with `node ./dist/worker.js` or `ts-node src/worker.ts` in dev.
 */

import { Worker, Queue } from 'bullmq';
import { connectionObj } from '@/services/queue.js';
import { evaluateDocuments } from '@/services/evaluator.js';
import { updateEvaluationStatus } from '@/services/supabase.js';
import { config } from '@/config/index.js';

// set up scheduler (required for repeatable jobs / delayed)
new Queue(config.queueName, { connection: connectionObj });

const worker = new Worker(
  config.queueName,
  async (job) => {
    try{
      console.log('processing job', job.id, job.name, job.data);
      const { candidateId, cvPath, projectPath } = job.data;
      const result = await updateEvaluationStatus(candidateId, {
        stage: "Processing",
        status: "processing",
        progress: 0,
        updated_at: new Date().toISOString(),
      });
      if (result.status !== "success") throw new Error(result.message);

      await evaluateDocuments({ candidateId, cvPath, projectPath });

  } catch (error) {
    console.error(error);
    return error;
  }
  },
  { connection: connectionObj, concurrency: 2 }
);

worker.on('completed', (job) => {
  try{
    updateEvaluationStatus(job.data.candidateId, {
      stage: "Done",
      status: "completed",
      progress: 100,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
  }
});
worker.on('failed', (job, err) => {
  try{
    updateEvaluationStatus(job?.data.candidateId, {
      stage: err.message,
      status: "Error",
      progress: 100,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
  }
});
console.log(`Worker started (queue=${config.queueName})`);
