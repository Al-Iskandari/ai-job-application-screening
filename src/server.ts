import express from 'express';
import router from '@/api/routes.js';
import { config } from '@/config/index.js';
import bodyParser from 'body-parser';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { error } from 'console';
import { errorHandler } from './api/middleware/errorHandler.js';

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(path.join(__dirname, '../public')));

/** 
Mount API under /api
public routes and app routes
*/
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Auth routes
app.use('/api', router);

// Health check
app.get("/healthz", (_, res) => res.status(200).send("OK"));

// Error handler
app.use(errorHandler);

// Start the server
app.listen(config.port, "0.0.0.0",() => {
  console.log(`Server listening on port ${config.port}`);
});
