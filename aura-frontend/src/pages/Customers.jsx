import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { api, currency, date, unwrap } from '../lib/api';

const tiers = ['', 'vip', 'regular', 'at_risk', 'new'];
const cities = ['', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'];

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, limit: 50 });
  const [filters, setFilters] = useState({ search: '', tier: '', city: '', page: 1 });
  const [selected, setSelected] = useState(null);
  const [importModal, setImportModal] = useState(false);

  const loadCustomers = () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    api.get(`/api/customers?${params}`).then((res) => {
      setRows(res.data.data);
      setMeta(res.data.meta);
    });
  };

  useEffect(() => {
    loadCustomers();
  }, [filters]);

  const totalPages = Math.max(Math.ceil((meta.total || 0) / meta.limit), 1);
  const open = (id) => api.get(`/api/customers/${id}`).then(unwrap).then(setSelected);

  return (
    <section className="p-5 md:p-7">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-slate-400">Search shoppers, inspect value, and understand recency.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn btn-primary" onClick={() => setImportModal(true)}>Import Data</button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input className="input pl-9" placeholder="Search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} />
          </div>
          <select className="input w-40" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value, page: 1 })}>
            {cities.map((city) => <option key={city} value={city}>{city || 'All cities'}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tiers.map((tier) => (
          <button key={tier || 'all'} className={`btn ${filters.tier === tier ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilters({ ...filters, tier, page: 1 })}>
            {tier ? tier.replace('_', ' ') : 'all'}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table w-full min-w-[900px]">
          <thead><tr><th>Name</th><th>Email</th><th>City</th><th>Tier</th><th>Total Spent</th><th>Orders</th><th>Last Order</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => open(customer.id)}>
                <td className="font-medium">{customer.name}</td>
                <td className="text-slate-400">{customer.email}</td>
                <td>{customer.city}</td>
                <td><StatusBadge value={customer.tier} /></td>
                <td className="mono">{currency(customer.total_spent)}</td>
                <td className="mono">{customer.order_count}</td>
                <td>{date(customer.last_order_at)}</td>
                <td><button className="btn btn-ghost py-1">Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft size={16} /> Prev</button>
        <span className="mono text-sm text-slate-400">{filters.page} / {totalPages}</span>
        <button className="btn btn-ghost" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next <ChevronRight size={16} /></button>
      </div>
      {selected && <Drawer customer={selected} onClose={() => setSelected(null)} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onImported={loadCustomers} />}
    </section>
  );
}

function Drawer({ customer, onClose }) {
  const days = customer.last_order_at ? Math.floor((Date.now() - new Date(customer.last_order_at)) / 86400000) : 0;
  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full max-w-[400px] border-l border-white/[0.06] bg-[#12141A] p-5 shadow-2xl">
      <button className="btn btn-ghost mb-4 h-8 w-8 p-0" onClick={onClose}><X size={16} /></button>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-500 font-bold">{customer.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</div>
        <div><h2 className="font-semibold">{customer.name}</h2><p className="text-sm text-slate-400">{customer.email}</p></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="card p-3"><div className="text-xs text-slate-400">Spent</div><div className="mono">{currency(customer.total_spent)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">Orders</div><div className="mono">{customer.order_count}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">LTV</div><div className="mono">{currency(customer.total_spent)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">Days Since</div><div className="mono">{days}</div></div>
      </div>
      <button className="btn btn-primary mt-5 w-full">Add to Segment</button>
      <h3 className="mt-6 mb-2 font-semibold">Order History</h3>
      <div className="grid gap-2">
        {customer.orders.map((order) => (
          <div className="rounded-lg bg-black/20 p-3" key={order.id}>
            <div className="flex justify-between"><span>{date(order.ordered_at)}</span><span className="mono">{currency(order.amount)}</span></div>
            <div className="text-xs text-slate-500">{order.channel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImported }) {
  const [tab, setTab] = useState('customers'); // 'customers' or 'orders'
  const [dataText, setDataText] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [busy, setBusy] = useState(false);

  const sampleCustomers = [
    { name: "Niharika Sen", email: "niharika.sen@gmail.com", phone: "+919876543210", city: "Bangalore", tier: "regular", tags: ["styling-consult", "new-buyer"] },
    { name: "Aditya Roy", email: "aditya.roy@yahoo.com", phone: "+919123456789", city: "Delhi", tier: "regular", tags: ["sale-seeker"] },
    { name: "Kavya Nair", email: "kavya.nair@outlook.com", phone: "+919567890123", city: "Mumbai", tier: "regular", tags: ["online", "vip-club"] }
  ];

  const sampleOrders = [
    { email: "niharika.sen@gmail.com", amount: 12500, channel: "whatsapp", items: [{ sku: "NT-1045", name: "Silk Kurta", qty: 1 }], ordered_at: new Date().toISOString() },
    { email: "aditya.roy@yahoo.com", amount: 3400, channel: "sms", items: [{ sku: "NT-1012", name: "Linen Shirt", qty: 1 }], ordered_at: new Date().toISOString() },
    { email: "kavya.nair@outlook.com", amount: 8900, channel: "email", items: [{ sku: "NT-1090", name: "Tailored Trousers", qty: 1 }], ordered_at: new Date().toISOString() }
  ];

  const loadSample = () => {
    const sample = tab === 'customers' ? sampleCustomers : sampleOrders;
    setDataText(JSON.stringify(sample, null, 2));
    setStatus({ type: '', msg: '' });
  };

  const handleImport = async () => {
    try {
      setBusy(true);
      setStatus({ type: '', msg: '' });
      const parsed = JSON.parse(dataText);
      if (!Array.isArray(parsed)) {
        throw new Error('Data must be a JSON array of objects.');
      }
      
      const endpoint = tab === 'customers' ? '/api/customers/bulk-import' : '/api/orders/bulk-import';
      await api.post(endpoint, parsed);
      
      setStatus({ type: 'success', msg: `Successfully imported ${parsed.length} records!` });
      setDataText('');
      setTimeout(() => {
        onImported();
        onClose();
      }, 1500);
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Data Ingestion Portal" onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex gap-2 border-b border-white/[0.06] pb-2">
          <button className={`btn py-1 text-sm ${tab === 'customers' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setTab('customers'); setDataText(''); setStatus({ type: '', msg: '' }); }}>Customers</button>
          <button className={`btn py-1 text-sm ${tab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setTab('orders'); setDataText(''); setStatus({ type: '', msg: '' }); }}>Orders</button>
        </div>
        <p className="text-xs text-slate-400">
          {tab === 'customers' 
            ? 'Import customer profiles. Existing email conflict will update names.' 
            : 'Import order transactions. Orders automatically update customer aggregates and trigger campaign attribution.'}
        </p>
        <div>
          <textarea 
            className="input min-h-48 mono text-xs" 
            placeholder={`Paste JSON array of ${tab}...`} 
            value={dataText} 
            onChange={(e) => setDataText(e.target.value)} 
          />
        </div>
        <div className="flex justify-between gap-2">
          <button className="btn btn-ghost text-xs" onClick={loadSample}>Load Sample Data</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!dataText.trim() || busy}>
            {busy ? 'Ingesting...' : 'Submit Ingestion'}
          </button>
        </div>
        {status.msg && (
          <div className={`rounded-lg p-3 text-xs ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
            {status.msg}
          </div>
        )}
      </div>
    </Modal>
  );
}
