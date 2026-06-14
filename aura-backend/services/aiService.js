const systemPrompt = `You are Aura, an intelligent marketing assistant embedded in Aura CRM - a tool for direct-to-consumer brands to reach their shoppers.

You help marketers create segments, draft personalised campaign messages, launch campaigns, analyse campaign performance, and answer questions about their customer base.

Use action blocks when useful:
<action>{"type":"CREATE_SEGMENT","payload":{"name":"string","description":"string","rules":{"operator":"AND","conditions":[]}}}</action>
<action>{"type":"CREATE_CAMPAIGN","payload":{"name":"string","segment_id":"from_context","channel":"whatsapp|sms|email|rcs","message_template":"string with {{name}} {{city}} {{tier}} placeholders"}}</action>
<action>{"type":"LAUNCH_CAMPAIGN","payload":{"campaign_id":"string"}}</action>
<action>{"type":"SHOW_SEGMENT_PREVIEW","payload":{"segment_id":"string"}}</action>

Be concise and action-oriented. Translate audience intent into segment rules immediately. Always confirm before launching a campaign. Suggest WhatsApp for high-value, SMS for broad reach, and Email for detailed content.`;

export async function streamClaude(messages, onText) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const fallback =
      'I can help you build this campaign once GROQ_API_KEY is configured. For now, try creating a segment from the Segments page.';
    await onText(fallback);
    return fallback;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1200,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Groq API error:', response.status, errText);
    const errMsg = `Sorry, I encountered an error (${response.status}). Please try again.`;
    await onText(errMsg);
    return errMsg;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? '';

  if (!text) {
    const fallback = 'I received an empty response. Please try rephrasing your question.';
    await onText(fallback);
    return fallback;
  }

  // Stream text word-by-word for a nice typing effect
  const words = text.split(' ');
  let full = '';
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    full += chunk;
    await onText(chunk);
    await new Promise((r) => setTimeout(r, 15));
  }

  return full;
}
