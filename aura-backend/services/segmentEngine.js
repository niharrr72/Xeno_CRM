import { ApiError } from '../middleware/errorHandler.js';

const fields = {
  total_spent: 'total_spent',
  order_count: 'order_count',
  tier: 'tier',
  last_order_at: 'last_order_at',
  first_order_at: 'first_order_at',
  city: 'city',
  tags: 'tags'
};

const scalarOps = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

export function buildWhereClause(rules = {}) {
  const operator = String(rules.operator || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
  const conditions = Array.isArray(rules.conditions) ? rules.conditions : [];
  const values = [];
  const clauses = [];

  for (const condition of conditions) {
    const column = fields[condition.field];
    if (!column) throw new ApiError(400, `Unsupported segment field: ${condition.field}`, 'INVALID_SEGMENT_FIELD');
    const op = condition.op;
    const value = condition.value;

    if (condition.field === 'tags') {
      const list = Array.isArray(value) ? value : [value];
      values.push(list);
      if (op === 'eq' || op === 'in') clauses.push(`tags && $${values.length}`);
      else if (op === 'neq' || op === 'not_in') clauses.push(`NOT (tags && $${values.length})`);
      else throw new ApiError(400, `Unsupported tags operator: ${op}`, 'INVALID_SEGMENT_OPERATOR');
    } else if (scalarOps[op]) {
      values.push(value);
      clauses.push(`${column} ${scalarOps[op]} $${values.length}`);
    } else if (op === 'in' || op === 'not_in') {
      if (!Array.isArray(value) || value.length === 0) throw new ApiError(400, `${op} requires a non-empty array`, 'INVALID_SEGMENT_RULE');
      values.push(value);
      clauses.push(`${column} ${op === 'in' ? '= ANY' : '<> ALL'}($${values.length})`);
    } else if (op === 'days_ago_lte' || op === 'days_ago_gte') {
      const comparison = op === 'days_ago_lte' ? '>=' : '<=';
      values.push(`${Number(value)} days`);
      clauses.push(`${column} ${comparison} NOW() - $${values.length}::interval`);
    } else {
      throw new ApiError(400, `Unsupported segment operator: ${op}`, 'INVALID_SEGMENT_OPERATOR');
    }
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(` ${operator} `)}` : '',
    values
  };
}

export async function previewSegment(pool, rules, limit = 50) {
  const { where, values } = buildWhereClause(rules);
  const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM customers ${where}`, values);
  const listResult = await pool.query(
    `SELECT id, name, email, city, tier, total_spent, order_count, last_order_at
     FROM customers ${where}
     ORDER BY total_spent DESC
     LIMIT $${values.length + 1}`,
    [...values, limit]
  );
  return { count: countResult.rows[0].count, customers: listResult.rows };
}
