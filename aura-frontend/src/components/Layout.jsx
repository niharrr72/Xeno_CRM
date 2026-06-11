import { BarChart3, Bot, Megaphone, PieChart, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, unwrap } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

const nav = [
  ['/dashboard', 'Dashboard', BarChart3],
  ['/customers', 'Customers', Users],
  ['/segments', 'Segments', PieChart],
  ['/campaigns', 'Campaigns', Megaphone],
  ['/ai', 'AI Assistant', Bot]
];

export default function Layout({ children }) {
  const { route, setRoute } = useAppStore();
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/api/analytics/overview').then(unwrap).then(setOverview).catch(() => {});
  }, [route]);

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:fixed md:inset-y-0 md:left-0 md:w-[220px] border-r border-white/[0.06] bg-[#12141A] p-4">
        <div className="mb-7">
          <div className="flex items-center gap-2 text-xl font-extrabold">
            Aura <span className="h-2 w-2 rounded-full bg-indigo-400" />
          </div>
          <div className="text-xs text-slate-500">Noir & Thread</div>
        </div>
        <nav className="grid gap-1">
          {nav.map(([href, label, Icon]) => (
            <button
              key={href}
              onClick={() => setRoute(href)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left ${route === href ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs text-slate-400">
          <div><span className="mono text-slate-100">{overview?.total_customers || 0}</span> customers</div>
          <div><span className="mono text-slate-100">{overview?.active_campaigns || 0}</span> active campaigns</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:ml-[220px]">{children}</main>
    </div>
  );
}
