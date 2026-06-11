import express from 'express';
import { pool } from '../db/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, validateRequired } from '../middleware/response.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const offset = (page - 1) * limit;
  const clauses = [];
  const values = [];
  for (const [key, column] of [['tier', 'tier'], ['city', 'city']]) {
    if (req.query[key]) {
      values.push(req.query[key]);
      clauses.push(`${column} = $${values.length}`);
    }
  }
  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    clauses.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM customers ${where}`, values);
  const list = await pool.query(
    `SELECT * FROM customers ${where} ORDER BY total_spent DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  ok(res, list.rows, { total: count.rows[0].total, page, limit });
}));

router.post('/', asyncHandler(async (req, res) => {
  validateRequired(req.body, ['name', 'email']);
  const result = await pool.query(
    `INSERT INTO customers (name, email, phone, city, tier, tags)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.body.name, req.body.email, req.body.phone || null, req.body.city || null, req.body.tier || 'regular', req.body.tags || []]
  );
  ok(res, result.rows[0], undefined, 201);
}));

router.post('/bulk-import', asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body)) throw new ApiError(400, 'Body must be a JSON array', 'VALIDATION_ERROR');
  const inserted = [];
  for (const customer of req.body) {
    validateRequired(customer, ['name', 'email']);
    const result = await pool.query(
      `INSERT INTO customers (name, email, phone, city, tier, tags)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [customer.name, customer.email, customer.phone || null, customer.city || null, customer.tier || 'regular', customer.tags || []]
    );
    inserted.push(result.rows[0]);
  }
  ok(res, inserted, { total: inserted.length }, 201);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (!customer.rows[0]) throw new ApiError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
  const orders = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY ordered_at DESC LIMIT 10', [req.params.id]);
  ok(res, { ...customer.rows[0], orders: orders.rows });
}));

export default router;
