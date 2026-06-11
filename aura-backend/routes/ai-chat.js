import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { streamClaude } from '../services/aiService.js';

const router = express.Router();

router.post('/chat', asyncHandler(async (req, res) => {
  const messages = req.body.messages;
  if (!Array.isArray(messages)) throw new ApiError(400, 'messages must be an array', 'VALIDATION_ERROR');
  const latest = messages[messages.length - 1];
  if (latest?.role === 'user') {
    await pool.query('INSERT INTO chat_messages (role, content, metadata) VALUES ($1,$2,$3)', ['user', latest.content, req.body.context || {}]);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  let full = '';
  await streamClaude(messages, async (text) => {
    full += text;
    res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
  });
  await pool.query('INSERT INTO chat_messages (role, content, metadata) VALUES ($1,$2,$3)', ['assistant', full, {}]);
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}));

export default router;
