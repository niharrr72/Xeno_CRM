import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../middleware/response.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();
const order = ['queued', 'sent', 'delivered', 'failed', 'opened', 'read', 'clicked', 'converted'];
const timestampColumn = {
  sent: 'sent_at',
  delivered: 'delivered_at',
  opened: 'opened_at',
  read: 'read_at',
  clicked: 'clicked_at',
  converted: 'converted_at'
};
const counterColumn = {
  delivered: 'delivered_count',
  failed: 'failed_count',
  opened: 'opened_count',
  read: 'read_count',
  clicked: 'clicked_count',
  converted: 'converted_count'
};

router.post('/callback', asyncHandler(async (req, res) => {
  const updates = req.body.updates;
  if (!Array.isArray(updates)) throw new ApiError(400, 'updates must be an array', 'VALIDATION_ERROR');
  let applied = 0;

  for (const update of updates) {
    const status = update.status;
    if (!order.includes(status)) continue;
    const event = await pool.query(
      `INSERT INTO communication_events (communication_id, status)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
      [update.communication_id, status]
    );
    if (!event.rows[0]) continue;

    const comm = await pool.query('SELECT * FROM communications WHERE id = $1', [update.communication_id]);
    if (!comm.rows[0]) continue;
    const currentRank = order.indexOf(comm.rows[0].status);
    const nextRank = order.indexOf(status);
    if (status !== 'failed' && nextRank < currentRank) continue;

    const tsColumn = timestampColumn[status];
    const timestamp = update.timestamp || new Date().toISOString();
    if (tsColumn) {
      await pool.query(`UPDATE communications SET status = $2, ${tsColumn} = $3 WHERE id = $1`, [update.communication_id, status, timestamp]);
    } else {
      await pool.query('UPDATE communications SET status = $2, failure_reason = $3 WHERE id = $1', [update.communication_id, status, update.failure_reason || 'Delivery failed']);
    }
    if (counterColumn[status]) {
      await pool.query(`UPDATE campaigns SET ${counterColumn[status]} = ${counterColumn[status]} + 1 WHERE id = $1`, [comm.rows[0].campaign_id]);
    }
    applied += 1;
  }

  ok(res, { applied });
}));

export default router;
