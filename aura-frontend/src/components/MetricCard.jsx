export default function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="card p-4 min-h-[112px]">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} />}
      </div>
      <div className="mono mt-4 text-2xl font-bold text-slate-50">{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-400">{detail}</div>}
    </div>
  );
}
