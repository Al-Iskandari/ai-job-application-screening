import { Queue } from "bullmq";
import { Redis, RedisOptions } from "ioredis";
import { config } from "@/config/index.js";

/**
 * Configure Redis connection for BullMQ.
 * Uses REDIS_URL in production, and host/port/password in development.
 */

let connection: Redis;

if (process.env.REDIS_URL) {
  // Production: Use full connection URL (TLS supported)
  connection = new Redis(process.env.REDIS_URL, {
    tls: process.env.NODE_ENV === "production" ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
} else {
  // Development: Use local docker-compose Redis config
  const connectionObj: RedisOptions = {
    host: config.redisHost || "127.0.0.1",
    port: config.redisPort || 6379,
    password: config.redisPassword || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  connection = new Redis(connectionObj);
}

// Create BullMQ Queue instance
export const evaluationQueue = new Queue(config.queueName, {
  connection,
});

