import { pool } from '../db/client.js';
import { previewSegment } from './segmentEngine.js';
import { ApiError } from '../middleware/errorHandler.js';

function personalize(template, customer) {
  return template
    .replaceAll('{{name}}', customer.name || '')
    .replaceAll('{{city}}', customer.city || '')
    .replaceAll('{{tier}}', customer.tier || '');
}

function recipientFor(channel, customer) {
  return channel === 'email' ? customer.email : customer.phone || customer.email;
}

export async function launchCampaign(campaignId) {
  const campaignResult = await pool.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
  if (campaign.status !== 'draft') throw new ApiError(400, 'Only draft campaigns can be launched', 'CAMPAIGN_NOT_DRAFT');

  const segmentResult = await pool.query('SELECT * FROM segments WHERE id = $1', [campaign.segment_id]);
  const segment = segmentResult.rows[0];
  if (!segment) throw new ApiError(404, 'Segment not found', 'SEGMENT_NOT_FOUND');

  const { customers } = await previewSegment(pool, segment.rules, 10000);
  await pool.query(
    `UPDATE campaigns SET status = 'sending', launched_at = NOW(), total_recipients = $2 WHERE id = $1`,
    [campaignId, customers.length]
  );

  const payloadRows = [];
  for (const customer of customers) {
    const message = personalize(campaign.message_template, customer);
    const comm = await pool.query(
      `INSERT INTO communications (campaign_id, customer_id, channel, message, status)
       VALUES ($1, $2, $3, $4, 'queued') RETURNING id`,
      [campaignId, customer.id, campaign.channel, message]
    );
    payloadRows.push({ id: comm.rows[0].id, recipient: recipientFor(campaign.channel, customer), channel: campaign.channel, message });
  }

  const channelUrl = process.env.CHANNEL_SERVICE_URL;
  if (!channelUrl) throw new ApiError(500, 'CHANNEL_SERVICE_URL is not configured', 'CHANNEL_URL_MISSING');
  const callbackUrl = `${process.env.CRM_BASE_URL || `http://localhost:${process.env.PORT || 3000}`}/api/receipts/callback`;

  for (let i = 0; i < payloadRows.length; i += 50) {
    const batch = payloadRows.slice(i, i + 50);
    const response = await fetch(`${channelUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({ communications: batch, callback_url: callbackUrl })
    });
    if (!response.ok) throw new ApiError(502, 'Channel service rejected campaign batch', 'CHANNEL_SEND_FAILED');
    const ids = batch.map((item) => item.id);
    await pool.query(
      `UPDATE communications SET status = 'sent', sent_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    await pool.query('UPDATE campaigns SET sent_count = sent_count + $2 WHERE id = $1', [campaignId, ids.length]);
  }

  await pool.query(`UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`, [campaignId]);
}
