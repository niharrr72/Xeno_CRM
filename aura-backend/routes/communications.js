import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../middleware/response.js';

const router = express.Router();

router.get('/recent', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT cm.*, c.name AS customer_name, ca.name AS campaign_name
    FROM communications cm
    LEFT JOIN customers c ON c.id = cm.customer_id
    LEFT JOIN campaigns ca ON ca.id = cm.campaign_id
    ORDER BY GREATEST(COALESCE(converted_at, cm.created_at), COALESCE(clicked_at, cm.created_at), COALESCE(read_at, cm.created_at), COALESCE(opened_at, cm.created_at), COALESCE(delivered_at, cm.created_at), COALESCE(sent_at, cm.created_at)) DESC
    LIMIT 10
  `);
  ok(res, result.rows);
}));

export default router;
