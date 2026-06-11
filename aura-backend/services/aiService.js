import Anthropic from '@anthropic-ai/sdk';

export const systemPrompt = `You are Aura, an intelligent marketing assistant embedded in Aura CRM - a tool for direct-to-consumer brands to reach their shoppers.

You help marketers create segments, draft personalised campaign messages, launch campaigns, analyse campaign performance, and answer questions about their customer base.

Use action blocks when useful:
<action>{"type":"CREATE_SEGMENT","payload":{"name":"string","description":"string","rules":{"operator":"AND","conditions":[]}}}</action>
<action>{"type":"CREATE_CAMPAIGN","payload":{"name":"string","segment_id":"from_context","channel":"whatsapp|sms|email|rcs","message_template":"string with {{name}} {{city}} {{tier}} placeholders"}}</action>
<action>{"type":"LAUNCH_CAMPAIGN","payload":{"campaign_id":"string"}}</action>
<action>{"type":"SHOW_SEGMENT_PREVIEW","payload":{"segment_id":"string"}}</action>

Be concise and action-oriented. Translate audience intent into segment rules immediately. Always confirm before launching a campaign. Suggest WhatsApp for high-value, SMS for broad reach, and Email for detailed content.`;

export async function streamClaude(messages, onText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = 'I can help you build this campaign once ANTHROPIC_API_KEY is configured. For now, try creating a segment from the Segments page.';
    await onText(fallback);
    return fallback;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let full = '';
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    system: systemPrompt,
    messages: messages.map((message) => ({ role: message.role, content: message.content }))
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      full += event.delta.text;
      await onText(event.delta.text);
    }
  }
  return full;
}
