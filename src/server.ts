import express from 'express';
import apiRouter from './api/routes';
import { config } from './config';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Mount API under /api
app.use('/api', apiRouter);

// health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
