import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from './db/migrate.js';
import { closePool } from './db/client.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import customersRouter from './routes/customers.js';
import segmentsRouter from './routes/segments.js';
import campaignsRouter from './routes/campaigns.js';
import communicationsRouter from './routes/communications.js';
import receiptsRouter from './routes/receipts.js';
import aiRouter from './routes/ai-chat.js';
import analyticsRouter from './routes/analytics.js';
import ordersRouter from './routes/orders.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aura-backend', timestamp: new Date().toISOString() });
});

app.use('/api/customers', customersRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/orders', ordersRouter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(notFound);
app.use(errorHandler);

await migrate();

const server = app.listen(port, () => {
  console.log(`${new Date().toISOString()} Aura backend listening on ${port}`);
});

async function shutdown() {
  console.log(`${new Date().toISOString()} Shutting down backend`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
