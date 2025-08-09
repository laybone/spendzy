import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const categories = ['HOUSING','GROCERIES','TRANSPORTATION','DINING','UTILITIES','ENTERTAINMENT','HEALTH','SHOPPING','SUBSCRIPTIONS','OTHER'];

export default function BudgetsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [budgets, setBudgets] = useState({});
  const [summary, setSummary] = useState({ byCategoryCents: {}, budgetsCents: {} });

  async function load() {
    const res = await axios.get('/api/budgets', { params: { month } });
    const map = {};
    for (const b of res.data) map[b.category] = (b.amountCents/100).toFixed(2);
    setBudgets(map);

    const s = await axios.get('/api/analytics/monthly-summary', { params: { month } });
    setSummary(s.data);
  }

  useEffect(()=>{ load(); }, [month]);

  async function save() {
    const items = categories.map(c => ({ category: c, amount: parseFloat(budgets[c]||'0')||0 }));
    await axios.post('/api/budgets', { month, items });
    await load();
  }

  const warnings = useMemo(()=>{
    const w = [];
    for (const c of categories) {
      const spent = (summary.byCategoryCents?.[c]||0)/100;
      const budget = (summary.budgetsCents?.[c]||0)/100;
      if (budget > 0 && spent > budget) w.push({ category: c, overBy: (spent - budget).toFixed(2) });
    }
    return w;
  }, [summary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label>Month:</label>
        <input type="month" className="border rounded px-3 py-2" value={month} onChange={e=>setMonth(e.target.value)} />
        <button onClick={save} className="bg-blue-600 text-white rounded px-3 py-2">Save Budgets</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(c => (
          <div key={c} className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c}</div>
              <div className="text-sm text-gray-500">Budget</div>
            </div>
            <input type="number" step="0.01" className="mt-2 w-full border rounded px-3 py-2" value={budgets[c]||''} onChange={e=>setBudgets({...budgets, [c]: e.target.value})} />
            <div className="mt-2 text-sm text-gray-600">Spent: ${((summary.byCategoryCents?.[c]||0)/100).toFixed(2)}</div>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <div className="font-semibold mb-2">Over budget warnings</div>
          <ul className="list-disc pl-6 space-y-1">
            {warnings.map(w => (
              <li key={w.category}>{w.category}: over by ${w.overBy}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}