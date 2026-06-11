import { pool } from './client.js';
import { previewSegment } from '../services/segmentEngine.js';

const firstNames = [
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Kabir', 'Isha', 'Vivaan', 'Meera', 'Arjun', 'Saanvi',
  'Aditya', 'Nisha', 'Dev', 'Tara', 'Karan', 'Aditi', 'Riya', 'Siddharth', 'Neha', 'Rahul',
  'Maya', 'Neil', 'Zara', 'Aisha', 'Vikram', 'Sara', 'Nikhil', 'Diya', 'Ira', 'Reyansh',
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Mason', 'Sophia', 'Lucas', 'Mia', 'Ethan'
];
const lastNames = [
  'Sharma', 'Mehta', 'Kapoor', 'Reddy', 'Iyer', 'Patel', 'Malhotra', 'Singh', 'Nair', 'Gupta',
  'Khan', 'Das', 'Joshi', 'Chopra', 'Rao', 'Verma', 'Thomas', 'Wilson', 'Brown', 'Garcia'
];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'];
const channels = ['whatsapp', 'sms', 'email', 'rcs'];

function pick(arr, index) {
  return arr[index % arr.length];
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function money(amount) {
  return Number(amount.toFixed(2));
}

async function createSchema() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } catch (error) {
    console.log(`${new Date().toISOString()} pgcrypto extension unavailable; continuing with built-in gen_random_uuid()`);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      city VARCHAR(100),
      tier VARCHAR(20) DEFAULT 'regular',
      total_spent DECIMAL(10,2) DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      last_order_at TIMESTAMPTZ,
      first_order_at TIMESTAMPTZ,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'completed',
      channel VARCHAR(50),
      items JSONB DEFAULT '[]',
      ordered_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      rules JSONB NOT NULL,
      customer_count INTEGER DEFAULT 0,
      created_by VARCHAR(50) DEFAULT 'ai',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      segment_id UUID REFERENCES segments(id),
      channel VARCHAR(20) NOT NULL,
      message_template TEXT NOT NULL,
      status VARCHAR(30) DEFAULT 'draft',
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      converted_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      launched_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS communications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id),
      channel VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(30) DEFAULT 'queued',
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      read_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      converted_at TIMESTAMPTZ,
      failure_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS communication_events (
      communication_id UUID REFERENCES communications(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (communication_id, status)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedCustomers() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM customers');
  if (rows[0].count > 0) return;

  for (let i = 0; i < 200; i += 1) {
    const name = `${pick(firstNames, i)} ${pick(lastNames, i * 7)}`;
    const city = pick(cities, i * 5);
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}${i + 1}@example.com`;
    const tags = i % 10 === 0 ? ['premium', 'styling-consult'] : i % 7 === 0 ? ['sale-seeker'] : i % 5 === 0 ? ['online'] : ['retail'];
    await pool.query(
      `INSERT INTO customers (name, email, phone, city, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, `+91${9000000000 + i * 137}`, city, tags, daysAgo(540 - (i % 360))]
    );
  }

  const customers = await pool.query('SELECT id FROM customers ORDER BY created_at ASC');
  let orderIndex = 0;
  for (const customer of customers.rows) {
    const orderCount = 2 + (orderIndex % 5);
    for (let j = 0; j < orderCount; j += 1) {
      const premiumBoost = orderIndex < 25 ? 6000 : 0;
      const staleOffset = orderIndex % 6 === 0 ? 110 : 0;
      const amount = money(450 + ((orderIndex * 173 + j * 911) % 14550) + premiumBoost);
      const orderedAt = daysAgo(((orderIndex * 11 + j * 31) % 500) + staleOffset);
      const items = [
        { sku: `NT-${1000 + ((orderIndex + j) % 80)}`, name: pick(['Linen Shirt', 'Silk Kurta', 'Denim Jacket', 'Tailored Trousers', 'Cotton Dress'], orderIndex + j), qty: 1 }
      ];
      await pool.query(
        `INSERT INTO orders (customer_id, amount, status, channel, items, ordered_at)
         VALUES ($1, $2, 'completed', $3, $4, $5)`,
        [customer.id, amount, pick(channels, orderIndex + j), JSON.stringify(items), orderedAt]
      );
    }
    orderIndex += 1;
  }

  await pool.query(`
    UPDATE customers c
    SET total_spent = o.total_spent,
        order_count = o.order_count,
        first_order_at = o.first_order_at,
        last_order_at = o.last_order_at
    FROM (
      SELECT customer_id, SUM(amount) AS total_spent, COUNT(*)::int AS order_count,
             MIN(ordered_at) AS first_order_at, MAX(ordered_at) AS last_order_at
      FROM orders GROUP BY customer_id
    ) o
    WHERE c.id = o.customer_id
  `);

  await pool.query(`
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

async function seedSegmentsAndCampaigns() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM segments');
  if (rows[0].count > 0) return;

  const segmentDefs = [
    ['VIP High-Spenders', 'Top spenders with strong purchase intent.', { operator: 'AND', conditions: [{ field: 'tier', op: 'eq', value: 'vip' }, { field: 'total_spent', op: 'gte', value: 10000 }] }],
    ['At-Risk Loyal Customers', 'Previously active shoppers who have not ordered in 90 days.', { operator: 'AND', conditions: [{ field: 'order_count', op: 'gte', value: 3 }, { field: 'last_order_at', op: 'days_ago_gte', value: 90 }] }],
    ['New Mumbai Shoppers', 'Recently acquired Mumbai shoppers ready for onboarding.', { operator: 'AND', conditions: [{ field: 'city', op: 'eq', value: 'Mumbai' }, { field: 'first_order_at', op: 'days_ago_lte', value: 540 }] }]
  ];

  const segmentIds = [];
  for (const [name, description, rules] of segmentDefs) {
    const result = await pool.query(
      'INSERT INTO segments (name, description, rules, customer_count, created_by) VALUES ($1, $2, $3, 0, $4) RETURNING id',
      [name, description, rules, name.includes('Mumbai') ? 'manual' : 'ai']
    );
    const preview = await previewSegment(pool, rules, 1);
    await pool.query('UPDATE segments SET customer_count = $2 WHERE id = $1', [result.rows[0].id, preview.count]);
    segmentIds.push(result.rows[0].id);
  }

  const campaignDefs = [
    ['Diwali Flash Sale', segmentIds[0], 'whatsapp', 'Hi {{name}}, your Noir & Thread Diwali preview is live. Use AURA25 for early access.', 180, { delivered: 166, opened: 118, read: 90, clicked: 42, converted: 12 }],
    ['New Collection Launch', segmentIds[2], 'email', 'Hi {{name}}, new silhouettes have arrived for {{city}}. Explore the Noir & Thread edit.', 95, { delivered: 84, opened: 43, read: 30, clicked: 15, converted: 4 }],
    ['Re-engagement Blast', segmentIds[1], 'sms', 'Hi {{name}}, we saved a private comeback offer for you at Noir & Thread.', 220, { delivered: 189, opened: 58, read: 40, clicked: 12, converted: 2 }]
  ];

  const customers = await pool.query('SELECT id, name, city, tier FROM customers ORDER BY total_spent DESC LIMIT 220');
  for (const [name, segmentId, channel, template, total, stats] of campaignDefs) {
    const campaign = await pool.query(
      `INSERT INTO campaigns
       (name, segment_id, channel, message_template, status, total_recipients, sent_count, delivered_count, failed_count, opened_count, read_count, clicked_count, converted_count, launched_at, completed_at)
       VALUES ($1,$2,$3,$4,'completed',$5,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [name, segmentId, channel, template, total, stats.delivered, total - stats.delivered, stats.opened, stats.read, stats.clicked, stats.converted, daysAgo(25), daysAgo(24)]
    );
    for (let i = 0; i < total; i += 1) {
      const customer = customers.rows[i % customers.rows.length];
      const finalStatus = i >= stats.delivered ? 'failed'
                        : i < stats.converted ? 'converted'
                        : i < stats.clicked ? 'clicked'
                        : i < stats.read ? 'read'
                        : i < stats.opened ? 'opened'
                        : 'delivered';
      const message = template.replace('{{name}}', customer.name).replace('{{city}}', customer.city).replace('{{tier}}', customer.tier);
      await pool.query(
        `INSERT INTO communications
         (campaign_id, customer_id, channel, message, status, sent_at, delivered_at, opened_at, read_at, clicked_at, converted_at, failure_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          campaign.rows[0].id,
          customer.id,
          channel,
          message,
          finalStatus,
          daysAgo(25),
          finalStatus === 'failed' ? null : daysAgo(24),
          ['opened', 'read', 'clicked', 'converted'].includes(finalStatus) ? daysAgo(24) : null,
          ['read', 'clicked', 'converted'].includes(finalStatus) ? daysAgo(23.5) : null,
          ['clicked', 'converted'].includes(finalStatus) ? daysAgo(23) : null,
          finalStatus === 'converted' ? daysAgo(22) : null,
          finalStatus === 'failed' ? 'Carrier rejected message' : null,
          daysAgo(25)
        ]
      );
    }
  }
}

export async function migrate() {
  await createSchema();
  await seedCustomers();
  await seedSegmentsAndCampaigns();
  console.log(`${new Date().toISOString()} Database migration complete`);
}
