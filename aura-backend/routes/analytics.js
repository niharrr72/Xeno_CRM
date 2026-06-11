import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../middleware/response.js';

const router = express.Router();

router.get('/overview', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM customers) AS total_customers,
      (SELECT COUNT(*)::int FROM campaigns WHERE status IN ('draft','sending')) AS active_campaigns,
      (SELECT COUNT(*)::int FROM communications WHERE sent_at >= date_trunc('month', NOW())) AS messages_sent_month,
      COALESCE((SELECT ROUND(100.0 * SUM(delivered_count)::numeric / NULLIF(SUM(sent_count), 0), 1) FROM campaigns), 0) AS avg_delivery_rate
  `);
  ok(res, result.rows[0]);
}));

router.get('/campaigns', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, name, channel, launched_at::date AS date, sent_count, delivered_count, opened_count, clicked_count, converted_count
    FROM campaigns
    ORDER BY launched_at DESC NULLS LAST
    LIMIT 30
  `);
  ok(res, result.rows);
}));

router.get('/messages-by-day', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT day::date, COALESCE(count, 0)::int AS count
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') day
    LEFT JOIN (
      SELECT sent_at::date AS sent_day, COUNT(*) AS count FROM communications
      WHERE sent_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY sent_at::date
    ) cm ON cm.sent_day = day::date
    ORDER BY day
  `);
  ok(res, result.rows);
}));

export default router;
