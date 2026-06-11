const colors = {
  vip: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  regular: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  at_risk: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  new: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  completed: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  sending: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  draft: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  failed: 'border-red-400/30 bg-red-500/10 text-red-200',
  delivered: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  opened: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  read: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
  clicked: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  converted: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  sent: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  queued: 'border-slate-400/20 bg-slate-500/10 text-slate-200'
};

export default function StatusBadge({ value }) {
  const key = String(value || '').toLowerCase();
  return <span className={`badge ${colors[key] || colors.regular}`}>{String(value || 'n/a').replace('_', ' ')}</span>;
}
