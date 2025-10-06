import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const connection = new IORedis(config.redisUrl);
export const evaluationQueue = new Queue(config.queueName, { connection });

// Export connection if worker files need it
export const connectionObj = connection;
