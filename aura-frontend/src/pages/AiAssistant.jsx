import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Play, Send, Sparkles } from 'lucide-react';
import { API_BASE, api, unwrap } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

const prompts = [
  "Identify customers who spent over Rs 10,000 and haven't purchased in 60 days",
  'Create a WhatsApp campaign for new customers with a welcome offer',
  'Which campaign performed best last month?',
  'Draft a message for VIP customers about an exclusive sale'
];

export default function AiAssistant() {
  const { messages, addMessage, updateLastAssistant, resetChat } = useAppStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState([]);

  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    const userMessage = { role: 'user', content: text.trim() };
    addMessage(userMessage);
    addMessage({ role: 'assistant', content: '' });
    setInput('');
    setBusy(true);
    let finalText = '';

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, userMessage], context: { actions } })
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === 'delta') {
          finalText += event.text;
          updateLastAssistant(event.text);
        }
      }
    }
    await executeActions(finalText, setActions);
    setBusy(false);
  };

  return (
    <section className="grid h-screen md:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-white/[0.06] bg-[#12141A] p-4 md:block">
        <button className="btn btn-primary mb-4 w-full" onClick={resetChat}><Sparkles size={16} /> New Chat</button>
        <div className="rounded-lg bg-black/20 p-3 text-sm text-slate-400">Noir & Thread growth workspace</div>
      </aside>
      <main className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2"><Bot size={18} /><span className="font-semibold">Aura AI</span><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="mx-auto grid max-w-3xl gap-4 pt-12 md:grid-cols-2">
              {prompts.map((prompt) => <button className="card p-5 text-left font-medium" key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
            </div>
          ) : (
            <div className="mx-auto grid max-w-4xl gap-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${message.role === 'user' ? 'bg-indigo-500 text-white' : 'card'} max-w-[78%] rounded-lg px-4 py-3`}>
                    {message.role === 'assistant' ? <ReactMarkdown>{stripActions(message.content) || (busy ? '...' : '')}</ReactMarkdown> : message.content}
                  </div>
                </div>
              ))}
              {actions.map((action, index) => <ActionCard key={index} action={action} />)}
            </div>
          )}
        </div>
        <div className="border-t border-white/[0.06] p-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex flex-wrap gap-2">
              {prompts.slice(0, 4).map((prompt) => <button className="btn btn-ghost py-1 text-xs" key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
            </div>
            <div className="flex gap-2">
              <textarea className="input min-h-[48px] flex-1 resize-none" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
              }} />
              <button className="btn btn-primary px-4" onClick={() => send()} disabled={busy}><Send size={16} /></button>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}

function stripActions(text) {
  return text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
}

async function executeActions(text, setActions) {
  const matches = [...text.matchAll(/<action>([\s\S]*?)<\/action>/g)];
  for (const match of matches) {
    const action = JSON.parse(match[1]);
    if (action.type === 'CREATE_SEGMENT') {
      const segment = await api.post('/api/segments', { ...action.payload, created_by: 'ai' }).then(unwrap);
      setActions((prev) => [...prev, { type: 'SEGMENT_CREATED', data: segment }]);
    }
    if (action.type === 'CREATE_CAMPAIGN') {
      const campaign = await api.post('/api/campaigns', action.payload).then(unwrap);
      setActions((prev) => [...prev, { type: 'CAMPAIGN_CREATED', data: campaign }]);
    }
    if (action.type === 'LAUNCH_CAMPAIGN') {
      const campaign = await api.post(`/api/campaigns/${action.payload.campaign_id}/launch`).then(unwrap);
      setActions((prev) => [...prev, { type: 'CAMPAIGN_LAUNCHED', data: campaign }]);
    }
  }
}

function ActionCard({ action }) {
  const title = action.type.replaceAll('_', ' ').toLowerCase();
  return (
    <div className="card mx-auto w-full max-w-4xl p-4">
      <div className="flex items-center gap-2 text-indigo-300"><Play size={16} /><span className="font-semibold">{title}</span></div>
      <div className="mt-2 text-sm text-slate-300">{action.data.name} {action.data.customer_count !== undefined ? `- ${action.data.customer_count} customers` : ''}</div>
    </div>
  );
}
