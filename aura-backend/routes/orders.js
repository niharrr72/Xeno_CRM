import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, validateRequired } from '../middleware/response.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

// Recalculates customer lifetime value (LTV), order count, and purchase dates.
// Updates all customer tiers because the VIP tier is based on the top 10% spenders (NTILE).
export async function updateCustomerStatsAndTiers(customerId, dbPool = pool) {
  // Update the aggregates for this customer
  await dbPool.query(`
    UPDATE customers c
    SET total_spent = COALESCE(o.total_spent, 0),
        order_count = COALESCE(o.order_count, 0),
        first_order_at = o.first_order_at,
        last_order_at = o.last_order_at
    FROM (
      SELECT 
        customer_id, 
        SUM(amount) AS total_spent, 
        COUNT(*)::int AS order_count,
        MIN(ordered_at) AS first_order_at, 
        MAX(ordered_at) AS last_order_at
      FROM orders 
      WHERE customer_id = $1
      GROUP BY customer_id
    ) o
    WHERE c.id = o.customer_id AND c.id = $1
  `, [customerId]);

  // Recalculate tiers for all customers (so spend deciles are correctly re-apportioned)
  await dbPool.query(`
    WITH ranked AS (
      SELECT id, NTILE(10) OVER (ORDER BY total_spent DESC) AS spend_decile FROM customers
    )
    UPDATE customers c
    SET tier = CASE
      WHEN r.spend_decile = 1 THEN 'vip'
      WHEN c.last_order_at < NOW() - INTERVAL '90 days' THEN 'at_risk'
      WHEN c.first_order_at > NOW() - INTERVAL '30 days' THEN 'new'
      ELSE 'regular'
    END
    FROM ranked r
    WHERE c.id = r.id
  `);
}

// Attributes a newly ingested order to the latest communication sent to the customer
// within a 7-day window. If found, records a conversion.
export async function attributeConversion(customerId, orderedAt, dbPool = pool) {
  // Find the latest communication sent/delivered/opened/read/clicked to this customer within 7 days
  const commQuery = await dbPool.query(`
    SELECT id, campaign_id, status FROM communications
    WHERE customer_id = $1 
      AND status != 'converted' 
      AND sent_at IS NOT NULL 
      AND sent_at <= $2 
      AND sent_at >= $2 - INTERVAL '7 days'
    ORDER BY sent_at DESC 
    LIMIT 1
  `, [customerId, orderedAt]);

  if (commQuery.rows.length > 0) {
    const comm = commQuery.rows[0];
    
    // Update communication status to converted
    await dbPool.query(`
      UPDATE communications 
      SET status = 'converted', converted_at = $2 
      WHERE id = $1
    `, [comm.id, orderedAt]);

    // Insert into communication_events
    await dbPool.query(`
      INSERT INTO communication_events (communication_id, status, created_at)
      VALUES ($1, 'converted', $2)
      ON CONFLICT DO NOTHING
    `, [comm.id, orderedAt]);

    // Increment campaign converted count
    await dbPool.query(`
      UPDATE campaigns 
      SET converted_count = converted_count + 1 
      WHERE id = $1
    `, [comm.campaign_id]);

    return { attributed: true, campaignId: comm.campaign_id, communicationId: comm.id };
  }
  return { attributed: false };
}

// GET /api/orders - lists orders
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT o.*, c.name AS customer_name, c.email AS customer_email
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    ORDER BY o.ordered_at DESC
    LIMIT 50
  `);
  ok(res, result.rows);
}));

// POST /api/orders - create a single order
router.post('/', asyncHandler(async (req, res) => {
  const { customer_id, email, amount, channel, items, ordered_at } = req.body;
  
  let targetCustomerId = customer_id;
  
  if (!targetCustomerId && email) {
    const customerResult = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (customerResult.rows.length > 0) {
      targetCustomerId = customerResult.rows[0].id;
    } else {
      // Auto-create customer if email is new
      const name = email.split('@')[0].split(/[._+-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      const newCustomerResult = await pool.query(
        `INSERT INTO customers (name, email, tier)
         VALUES ($1, $2, 'new') RETURNING id`,
        [name, email]
      );
      targetCustomerId = newCustomerResult.rows[0].id;
    }
  }
  
  if (!targetCustomerId) {
    throw new ApiError(400, 'Either customer_id or email is required', 'VALIDATION_ERROR');
  }
  
  if (amount === undefined || amount === null) {
    throw new ApiError(400, 'amount is required', 'VALIDATION_ERROR');
  }

  const orderTime = ordered_at || new Date().toISOString();
  
  const result = await pool.query(
    `INSERT INTO orders (customer_id, amount, channel, items, ordered_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [targetCustomerId, amount, channel || null, JSON.stringify(items || []), orderTime]
  );
  
  const newOrder = result.rows[0];
  
  // Update customer statistics and recalculate tiers
  await updateCustomerStatsTiers(targetCustomerId);
  
  // Run conversion attribution checks
  const attribution = await attributeConversion(targetCustomerId, orderTime);
  
  ok(res, { order: newOrder, attribution }, undefined, 201);
}));

// Helper to support updates under both function names
async function updateCustomerStatsTiers(customerId, dbPool = pool) {
  return updateCustomerStatsAndTiers(customerId, dbPool);
}

// POST /api/orders/bulk-import - bulk-import orders
router.post('/bulk-import', asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body)) {
    throw new ApiError(400, 'Body must be a JSON array', 'VALIDATION_ERROR');
  }
  
  const inserted = [];
  const affectedCustomerIds = new Set();
  
  for (const orderData of req.body) {
    const { customer_id, email, amount, channel, items, ordered_at } = orderData;
    
    let targetCustomerId = customer_id;
    if (!targetCustomerId && email) {
      const customerResult = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
      if (customerResult.rows.length > 0) {
        targetCustomerId = customerResult.rows[0].id;
      } else {
        const name = email.split('@')[0].split(/[._+-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        const newCustomerResult = await pool.query(
          `INSERT INTO customers (name, email, tier)
           VALUES ($1, $2, 'new') RETURNING id`,
          [name, email]
        );
        targetCustomerId = newCustomerResult.rows[0].id;
      }
    }
    
    if (!targetCustomerId || amount === undefined) {
      continue;
    }
    
    const orderTime = ordered_at || new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO orders (customer_id, amount, channel, items, ordered_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [targetCustomerId, amount, channel || null, JSON.stringify(items || []), orderTime]
    );
    
    inserted.push(result.rows[0]);
    affectedCustomerIds.add(targetCustomerId);
    
    // Check conversion attribution for this order
    await attributeConversion(targetCustomerId, orderTime);
  }
  
  // Recalculate statistics for all affected customers
  for (const customerId of affectedCustomerIds) {
    await updateCustomerStatsTiers(customerId);
  }
  
  ok(res, inserted, { total: inserted.length }, 201);
}));

export default router;
