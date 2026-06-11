import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { api, unwrap } from '../lib/api';

const emptyRule = { field: 'total_spent', op: 'gte', value: '5000' };

export default function Segments() {
  const [segments, setSegments] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/api/segments').then(unwrap).then(setSegments);
  useEffect(() => { load(); }, []);

  return (
    <section className="p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Segments</h1><p className="text-slate-400">Audience definitions powered by safe SQL rules.</p></div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={16} /> New Segment</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => (
          <div className="card p-4" key={segment.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{segment.name}</h2>
              <StatusBadge value={segment.created_by} />
            </div>
            <p className="mt-2 min-h-12 text-sm text-slate-400">{segment.description}</p>
            <div className="mono mt-4 text-3xl font-bold text-indigo-300">{segment.customer_count}</div>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setModal({ type: 'preview', segment })}>Preview</button>
              <button className="btn btn-primary flex-1" onClick={() => setModal({ type: 'campaign', segment })}>Create Campaign</button>
            </div>
          </div>
        ))}
      </div>
      {modal === 'new' && <SegmentModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'preview' && <PreviewModal segment={modal.segment} onClose={() => setModal(null)} />}
      {modal?.type === 'campaign' && <CampaignModal segment={modal.segment} onClose={() => setModal(null)} />}
    </section>
  );
}

function SegmentModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', rules: { operator: 'AND', conditions: [emptyRule] } });
  const [preview, setPreview] = useState(null);
  const conditions = form.rules.conditions;

  useEffect(() => {
    const timer = setTimeout(() => {
      api.post('/api/segments/preview', { rules: normalize(form.rules) }).then(unwrap).then(setPreview).catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.rules]);

  const save = async () => {
    await api.post('/api/segments', { ...form, rules: normalize(form.rules) });
    onSaved();
  };

  return (
    <Modal title="New Segment" onClose={onClose}>
      <div className="grid gap-3">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <textarea className="input min-h-24" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {conditions.map((rule, index) => (
          <div className="grid gap-2 md:grid-cols-3" key={index}>
            <select className="input" value={rule.field} onChange={(e) => updateRule(form, setForm, index, 'field', e.target.value)}>
              {['total_spent','order_count','tier','last_order_at','first_order_at','city','tags'].map((field) => <option key={field}>{field}</option>)}
            </select>
            <select className="input" value={rule.op} onChange={(e) => updateRule(form, setForm, index, 'op', e.target.value)}>
              {['eq','neq','gt','gte','lt','lte','in','not_in','days_ago_lte','days_ago_gte'].map((op) => <option key={op}>{op}</option>)}
            </select>
            <input className="input" value={rule.value} onChange={(e) => updateRule(form, setForm, index, 'value', e.target.value)} />
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setForm({ ...form, rules: { ...form.rules, conditions: [...conditions, emptyRule] } })}>Add Condition</button>
        <div className="rounded-lg bg-black/20 p-3 text-sm text-slate-400">Live preview: <span className="mono text-indigo-300">{preview?.count ?? '...'}</span> customers</div>
        <button className="btn btn-primary" onClick={save}>Save Segment</button>
      </div>
    </Modal>
  );
}

function PreviewModal({ segment, onClose }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => { api.get(`/api/segments/${segment.id}/preview`).then(unwrap).then(setPreview); }, [segment.id]);
  return (
    <Modal title={`Preview: ${segment.name}`} onClose={onClose}>
      <div className="mb-3 flex items-center gap-2 text-slate-400"><Users size={16} /> <span className="mono text-indigo-300">{preview?.count || 0}</span> matching customers</div>
      <div className="grid gap-2">
        {preview?.customers.map((customer) => (
          <div className="flex items-center justify-between rounded-lg bg-black/20 p-3" key={customer.id}>
            <div><div>{customer.name}</div><div className="text-xs text-slate-500">{customer.email}</div></div>
            <StatusBadge value={customer.tier} />
          </div>
        ))}
      </div>
    </Modal>
  );
}

function CampaignModal({ segment, onClose }) {
  const [form, setForm] = useState({ name: '', channel: 'whatsapp', message_template: 'Hi {{name}}, Noir & Thread has a private offer for you in {{city}}.' });
  const save = async () => {
    await api.post('/api/campaigns', { ...form, segment_id: segment.id });
    onClose();
  };
  return (
    <Modal title={`Campaign for ${segment.name}`} onClose={onClose}>
      <div className="grid gap-3">
        <input className="input" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          {['whatsapp','sms','email','rcs'].map((channel) => <option key={channel}>{channel}</option>)}
        </select>
        <textarea className="input min-h-32" value={form.message_template} onChange={(e) => setForm({ ...form, message_template: e.target.value })} />
        <button className="btn btn-primary" onClick={save}>Create Draft</button>
      </div>
    </Modal>
  );
}

function updateRule(form, setForm, index, key, value) {
  const conditions = form.rules.conditions.map((rule, i) => i === index ? { ...rule, [key]: value } : rule);
  setForm({ ...form, rules: { ...form.rules, conditions } });
}

function normalize(rules) {
  return {
    ...rules,
    conditions: rules.conditions.map((rule) => ({
      ...rule,
      value: ['in', 'not_in'].includes(rule.op) ? String(rule.value).split(',').map((v) => v.trim()) : numericOrString(rule.value)
    }))
  };
}

function numericOrString(value) {
  return Number.isNaN(Number(value)) || value === '' ? value : Number(value);
}
