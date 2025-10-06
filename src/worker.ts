/**
 * Worker process using bullmq to process evaluation jobs.
 * Run this with `node ./dist/worker.js` or `ts-node src/worker.ts` in dev.
 */

import { Worker, Queue } from 'bullmq';
import { connectionObj } from './services/queue';
import { evaluateDocuments } from './services/evaluator';
import { updateEvaluationStatus } from './services/firebase';
import { config } from './config';

// set up scheduler (required for repeatable jobs / delayed)
new Queue(config.queueName, { connection: connectionObj });

const worker = new Worker(
  config.queueName,
  async (job) => {
    console.log('processing job', job.id, job.name, job.data);
    const { candidateId, cvPath, reportPath, cvUrl, reportUrl } = job.data;
    updateEvaluationStatus(candidateId, {
      stage: "Processing",
      status: "processing",
      progress: 0,
      updatedAt: new Date().toISOString(),
    })
    return evaluateDocuments({ candidateId, cvPath, projectPath: reportPath, cvUrl, projectUrl: reportUrl });
  },
  { connection: connectionObj, concurrency: 2 }
);

worker.on('completed', (job) => {
  updateEvaluationStatus(job.data.candidateId, {
      stage: "Done",
      status: "completed",
      progress: 100,
      updatedAt: new Date().toISOString(),
    });
});
worker.on('failed', (job, err) => {
  updateEvaluationStatus(job?.data.candidateId, {
      stage: err.message,
      status: "Error",
      progress: 100,
      updatedAt: new Date().toISOString(),
    });
});
console.log(`Worker started (queue=${config.queueName})`);
