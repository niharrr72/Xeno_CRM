import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aura-channel', timestamp: new Date().toISOString() });
});

app.post('/send', async (req, res) => {
  const { communications, callback_url: callbackUrl } = req.body;
  if (!Array.isArray(communications) || !callbackUrl) {
    return res.status(400).json({ success: false, error: 'communications and callback_url are required' });
  }

  res.json({ accepted: communications.length, status: 'processing' });
  for (const comm of communications) simulateDelivery(comm, callbackUrl);
});

async function simulateDelivery(comm, callbackUrl) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(Math.random() * 3000 + 1000);
  if (Math.random() < 0.10) {
    await postCallback(callbackUrl, comm.id, 'failed');
    return;
  }

  await postCallback(callbackUrl, comm.id, 'delivered');
  if (Math.random() < 0.60) {
    await delay(Math.random() * 5000 + 2000);
    await postCallback(callbackUrl, comm.id, 'opened');
    if (Math.random() < 0.75) {
      await delay(Math.random() * 3000 + 1000);
      await postCallback(callbackUrl, comm.id, 'read');
      if (Math.random() < 0.40) {
        await delay(Math.random() * 3000 + 1000);
        await postCallback(callbackUrl, comm.id, 'clicked');
        if (Math.random() < 0.20) {
          await delay(Math.random() * 5000 + 2000);
          await postCallback(callbackUrl, comm.id, 'converted');
        }
      }
    }
  }
}

async function postCallback(callbackUrl, communicationId, status) {
  const payload = {
    updates: [{ communication_id: communicationId, status, timestamp: new Date().toISOString() }]
  };
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.INTERNAL_API_KEY || ''
  };
  try {
    await fetch(callbackUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await fetch(callbackUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  }
}

const server = app.listen(port, () => {
  console.log(`${new Date().toISOString()} Aura channel listening on ${port}`);
});

process.on('SIGTERM', () => {
  console.log(`${new Date().toISOString()} Shutting down channel service`);
  server.close(() => process.exit(0));
});
