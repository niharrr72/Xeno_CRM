import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, validateRequired } from '../middleware/response.js';
import { ApiError } from '../middleware/errorHandler.js';
import { launchCampaign } from '../services/campaignRunner.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, s.name AS segment_name
    FROM campaigns c LEFT JOIN segments s ON s.id = c.segment_id
    ORDER BY c.created_at DESC
  `);
  ok(res, result.rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const campaign = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
  if (!campaign.rows[0]) throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
  const breakdown = await pool.query('SELECT status, COUNT(*)::int AS count FROM communications WHERE campaign_id = $1 GROUP BY status', [req.params.id]);
  ok(res, { ...campaign.rows[0], breakdown: breakdown.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  validateRequired(req.body, ['name', 'segment_id', 'channel', 'message_template']);
  const result = await pool.query(
    `INSERT INTO campaigns (name, segment_id, channel, message_template, status)
     VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
    [req.body.name, req.body.segment_id, req.body.channel, req.body.message_template]
  );
  ok(res, result.rows[0], undefined, 201);
}));

router.post('/:id/launch', asyncHandler(async (req, res) => {
  await launchCampaign(req.params.id);
  const result = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
  ok(res, result.rows[0]);
}));

router.get('/:id/communications', asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const offset = (page - 1) * limit;
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM communications WHERE campaign_id = $1', [req.params.id]);
  const result = await pool.query(
    `SELECT cm.*, c.name AS customer_name, c.email, c.phone
     FROM communications cm LEFT JOIN customers c ON c.id = cm.customer_id
     WHERE cm.campaign_id = $1
     ORDER BY cm.created_at DESC LIMIT $2 OFFSET $3`,
    [req.params.id, limit, offset]
  );
  ok(res, result.rows, { total: count.rows[0].total, page, limit });
}));

export default router;
