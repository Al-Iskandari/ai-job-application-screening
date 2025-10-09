import express from 'express';
import authRouter from '@/api/authRoute.js';
import router from '@/api/routes.js';
import { config } from '@/config/index.js';
import bodyParser from 'body-parser';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

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

app.use('/api', router);


// Start the server
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
