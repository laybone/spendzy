import { useEffect, useState } from 'react';
import axios from 'axios';

const categories = ['HOUSING','GROCERIES','TRANSPORTATION','DINING','UTILITIES','ENTERTAINMENT','HEALTH','SHOPPING','SUBSCRIPTIONS','OTHER'];

export default function TransactionsPage() {
  const [form, setForm] = useState({ date: '', description: '', amount: '', category: '' });
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [items, setItems] = useState([]);

  async function load() {
    const res = await axios.get(`/api/transactions`, { params: { month } });
    setItems(res.data);
  }
  useEffect(() => { load(); }, [month]);

  async function submit(e) {
    e.preventDefault();
    const payload = {
      date: form.date,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category || undefined,
    };
    await axios.post('/api/transactions', payload);
    setForm({ date: '', description: '', amount: '', category: '' });
    await load();
  }

  async function uploadCsv(e) {
    e.preventDefault();
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    await axios.post('/api/transactions/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFile(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Add Transaction</h2>
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={submit}>
          <input type="date" required className="border rounded px-3 py-2" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          <input type="text" required placeholder="Description" className="border rounded px-3 py-2" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
          <input type="number" step="0.01" required placeholder="Amount" className="border rounded px-3 py-2" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
          <select className="border rounded px-3 py-2" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
            <option value="">Auto</option>
            {categories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="bg-blue-600 text-white rounded px-3 py-2">Save</button>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Import CSV</h2>
        <form className="flex items-center gap-3" onSubmit={uploadCsv}>
          <input type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0]||null)} />
          <button className="bg-blue-600 text-white rounded px-3 py-2">Upload</button>
        </form>
      </div>

      <div className="flex items-center gap-3">
        <label>Month:</label>
        <input type="month" className="border rounded px-3 py-2" value={month} onChange={e=>setMonth(e.target.value)} />
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx)=> (
              <tr key={tx.id} className="border-t">
                <td className="px-4 py-2">{new Date(tx.date).toISOString().slice(0,10)}</td>
                <td className="px-4 py-2">{tx.description}</td>
                <td className="px-4 py-2 text-right">${(tx.amountCents/100).toFixed(2)}</td>
                <td className="px-4 py-2">{tx.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}