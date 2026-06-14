const systemPrompt = `You are Aura, an intelligent marketing assistant embedded in Aura CRM - a tool for direct-to-consumer brands to reach their shoppers.

You help marketers create segments, draft personalised campaign messages, launch campaigns, analyse campaign performance, and answer questions about their customer base.

Use action blocks when useful:
<action>{"type":"CREATE_SEGMENT","payload":{"name":"string","description":"string","rules":{"operator":"AND","conditions":[]}}}</action>
<action>{"type":"CREATE_CAMPAIGN","payload":{"name":"string","segment_id":"from_context","channel":"whatsapp|sms|email|rcs","message_template":"string with {{name}} {{city}} {{tier}} placeholders"}}</action>
<action>{"type":"LAUNCH_CAMPAIGN","payload":{"campaign_id":"string"}}</action>
<action>{"type":"SHOW_SEGMENT_PREVIEW","payload":{"segment_id":"string"}}</action>

Be concise and action-oriented. Translate audience intent into segment rules immediately. Always confirm before launching a campaign. Suggest WhatsApp for high-value, SMS for broad reach, and Email for detailed content.`;

export async function streamClaude(messages, onText) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const fallback =
      'I can help you build this campaign once GEMINI_API_KEY is configured. For now, try creating a segment from the Segments page.';
    await onText(fallback);
    return fallback;
  }

  // Build Gemini contents array — prepend system prompt as first user turn
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am Aura, ready to help.' }] },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  ];

  // Use the simple (non-streaming) generateContent endpoint — reliable across all environments
  // Try gemini-2.0-flash first, fallback to gemini-1.5-flash-latest
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
  let response = null;
  let lastErrText = '';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
      })
    });
    if (response.ok) break;
    lastErrText = await response.text();
    console.error(`Gemini model ${model} error ${response.status}:`, lastErrText);
  }

  if (!response.ok) {
    console.error('All Gemini models failed. Last error:', lastErrText);
    const errMsg = `Sorry, I encountered an error (${response.status}): ${lastErrText.slice(0, 200)}`;
    await onText(errMsg);
    return errMsg;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
    // small delay for streaming feel
    await new Promise((r) => setTimeout(r, 15));
  }

  return full;
}
