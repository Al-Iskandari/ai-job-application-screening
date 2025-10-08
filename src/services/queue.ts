import { Queue } from 'bullmq';
import { RedisOptions } from 'ioredis';
import { config } from '@/config/index.js';

export const connectionObj: RedisOptions = {
  host: config.redisHost || "127.0.0.1",
  port: config.redisPort || 6379,
  password: config.redisPassword || undefined,
  maxRetriesPerRequest: null,  // Required by BullMQ
  enableReadyCheck: false,   
};

export const evaluationQueue = new Queue(config.queueName, { connection: connectionObj });