/**
 * Worker process using bullmq to process evaluation jobs.
 * Run this with `node ./dist/worker.js` or `ts-node src/worker.ts` in dev.
 */

import { Worker, Queue } from 'bullmq';
import { connectionObj } from './services/queue';
import { evaluateDocuments } from './services/evaluator';
import { config } from './config';

// set up scheduler (required for repeatable jobs / delayed)
new Queue(config.queueName, { connection: connectionObj });

const worker = new Worker(
  config.queueName,
  async (job) => {
    console.log('processing job', job.id, job.name, job.data);
    const { candidateId, cvPath, reportPath, cvUrl, reportUrl } = job.data;
    return evaluateDocuments({ candidateId, cvPath, projectPath: reportPath, cvUrl, projectUrl: reportUrl });
  },
  { connection: connectionObj, concurrency: 2 }
);

worker.on('completed', (job) => {
  console.log('job completed', job.id);
});
worker.on('failed', (job, err) => {
  console.error('job failed', job?.id, err);
});
console.log(`Worker started (queue=${config.queueName})`);
