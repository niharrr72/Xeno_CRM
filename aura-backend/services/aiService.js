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

  // Build Gemini contents array (user/model turns)
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  let full = '';
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          full += text;
          await onText(text);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full;
}
