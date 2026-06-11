import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Radio, Send, Users } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { api, unwrap } from '../lib/api';

export default function Dashboard() {
  const [overview, setOverview] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [daily, setDaily] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const load = () => {
      api.get('/api/analytics/overview').then(unwrap).then(setOverview);
      api.get('/api/analytics/campaigns').then(unwrap).then(setCampaigns);
      api.get('/api/analytics/messages-by-day').then(unwrap).then(setDaily);
      api.get('/api/communications/recent').then(unwrap).then(setRecent);
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="p-5 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400">Live performance overview for Noir & Thread.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Customers" value={overview.total_customers || 0} detail="+ seeded shoppers" icon={Users} />
        <MetricCard label="Messages Sent" value={overview.messages_sent_month || 0} detail="this month" icon={Send} />
        <MetricCard label="Avg Delivery Rate" value={`${overview.avg_delivery_rate || 0}%`} detail="all campaigns" icon={Activity} />
        <MetricCard label="Active Campaigns" value={overview.active_campaigns || 0} detail="draft or sending" icon={Radio} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="card p-4">
          <h2 className="mb-4 font-semibold">Messages Sent by Day</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => new Date(v).getDate()} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1A1D26', border: '1px solid rgba(255,255,255,0.06)', color: '#F1F5F9' }} />
                <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-4 font-semibold">Top Campaigns</h2>
          <div className="grid gap-3">
            {campaigns.slice(0, 5).map((campaign) => (
              <div key={campaign.id} className="rounded-lg bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{campaign.name}</span>
                  <span className="mono text-indigo-300">{campaign.delivered_count}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{campaign.channel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3 font-semibold">Recent Activity</div>
        <div className="overflow-x-auto">
          <table className="table w-full min-w-[720px]">
            <thead><tr><th>Customer</th><th>Campaign</th><th>Channel</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td>{row.customer_name}</td>
                  <td>{row.campaign_name}</td>
                  <td>{row.channel}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td className="mono text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
