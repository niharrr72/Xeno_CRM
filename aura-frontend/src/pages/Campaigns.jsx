import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import StatusBadge from '../components/StatusBadge';
import { api, date, unwrap } from '../lib/api';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [communications, setCommunications] = useState([]);

  const loadCampaigns = () => api.get('/api/campaigns').then(unwrap).then((data) => {
    setCampaigns(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
  });
  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => {
    if (!selectedId) return;
    const load = () => {
      api.get(`/api/campaigns/${selectedId}`).then(unwrap).then(setDetail);
      api.get(`/api/campaigns/${selectedId}/communications`).then(unwrap).then(setCommunications);
    };
    load();
    const timer = setInterval(load, detail?.status === 'sending' ? 4000 : 12000);
    return () => clearInterval(timer);
  }, [selectedId, detail?.status]);

  const launch = async () => {
    await api.post(`/api/campaigns/${selectedId}/launch`);
    loadCampaigns();
  };

  return (
    <section className="grid min-h-screen gap-0 xl:grid-cols-[35%_65%]">
      <aside className="border-r border-white/[0.06] p-5 md:p-7">
        <h1 className="mb-5 text-2xl font-bold">Campaigns</h1>
        <div className="grid gap-3">
          {campaigns.map((campaign) => {
            const pct = campaign.sent_count ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) : 0;
            return (
              <button key={campaign.id} onClick={() => setSelectedId(campaign.id)} className={`card p-4 text-left ${selectedId === campaign.id ? 'border-indigo-400/50' : ''}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{campaign.name}</span><StatusBadge value={campaign.status} /></div>
                <div className="mt-2 text-xs text-slate-500">{campaign.channel} · {campaign.total_recipients} recipients</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="p-5 md:p-7">
        {detail && (
          <>
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold">{detail.name}</h2>
                <div className="mt-1 flex gap-2 text-sm text-slate-400">{detail.channel} · {date(detail.launched_at)}</div>
              </div>
              <div className="flex gap-2"><StatusBadge value={detail.status} />{detail.status === 'draft' && <button className="btn btn-primary" onClick={launch}>Launch</button>}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {['sent','delivered','opened','read','clicked','converted'].map((key) => (
                <div className="card p-3" key={key}><div className="text-xs text-slate-400">{key}</div><div className="mono text-xl">{detail[`${key}_count`] || 0}</div></div>
              ))}
            </div>
            <div className="card mt-5 p-4">
              <h3 className="mb-4 font-semibold">Delivery Funnel</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={['sent','delivered','opened','read','clicked','converted'].map((key) => ({ name: key, value: detail[`${key}_count`] || 0 }))}>
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#1A1D26', border: '1px solid rgba(255,255,255,0.06)', color: '#F1F5F9' }} />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card mt-5 overflow-x-auto">
              <table className="table w-full min-w-[900px]">
                <thead><tr><th>Recipient</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Read</th><th>Clicked</th></tr></thead>
                <tbody>
                  {communications.map((row) => (
                    <tr key={row.id}><td>{row.customer_name}</td><td><StatusBadge value={row.status} /></td><td>{date(row.sent_at)}</td><td>{date(row.delivered_at)}</td><td>{date(row.opened_at)}</td><td>{date(row.read_at)}</td><td>{date(row.clicked_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </section>
  );
}
