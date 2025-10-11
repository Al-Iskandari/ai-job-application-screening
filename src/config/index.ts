import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'development') {
   dotenv.config({ path: "/etc/secrets/.env" });
}

export const config = {
  port: Number(process.env.PORT || 4000),

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Firebase
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH || '',
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Google / Gemini / PaLM
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',

  // Zilliz Cloud
  zillizApiKey: process.env.ZILLIZ_API_KEY || '',
  zillizBaseUrl: process.env.ZILLIZ_BASE_URL || '',

  // Redis (BullMQ)
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || undefined,

  // JWT for internal sessions (optional)
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret',

  // Limits
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024), // 10MB default

  // Queue Name
  queueName: process.env.QUEUE_NAME || 'evaluation',

  // Pipeline stages config
  DEFAULT_STAGE_RETRIES: 3, // attempts per stage
  DEFAULT_STAGE_BASE_DELAY_MS: 2000, // initial backoff
  DEFAULT_STAGE_TIMEOUT_MS: 60_000, // 60s default timeout for LLM/remote calls
};
