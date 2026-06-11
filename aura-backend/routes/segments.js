import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, validateRequired } from '../middleware/response.js';
import { ApiError } from '../middleware/errorHandler.js';
import { previewSegment } from '../services/segmentEngine.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM segments ORDER BY created_at DESC');
  ok(res, result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  validateRequired(req.body, ['name', 'rules']);
  const preview = await previewSegment(pool, req.body.rules, 1);
  const result = await pool.query(
    `INSERT INTO segments (name, description, rules, customer_count, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.body.name, req.body.description || '', req.body.rules, preview.count, req.body.created_by || 'manual']
  );
  ok(res, result.rows[0], undefined, 201);
}));

router.post('/preview', asyncHandler(async (req, res) => {
  validateRequired(req.body, ['rules']);
  ok(res, await previewSegment(pool, req.body.rules, 50));
}));

router.get('/:id/preview', asyncHandler(async (req, res) => {
  const segment = await pool.query('SELECT * FROM segments WHERE id = $1', [req.params.id]);
  if (!segment.rows[0]) throw new ApiError(404, 'Segment not found', 'SEGMENT_NOT_FOUND');
  ok(res, await previewSegment(pool, segment.rows[0].rules, 50));
}));

router.post('/:id/refresh', asyncHandler(async (req, res) => {
  const segment = await pool.query('SELECT * FROM segments WHERE id = $1', [req.params.id]);
  if (!segment.rows[0]) throw new ApiError(404, 'Segment not found', 'SEGMENT_NOT_FOUND');
  const preview = await previewSegment(pool, segment.rows[0].rules, 1);
  const updated = await pool.query('UPDATE segments SET customer_count = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id, preview.count]);
  ok(res, updated.rows[0]);
}));

export default router;
