import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

const CATS = ['HOUSING','GROCERIES','TRANSPORTATION','DINING','UTILITIES','ENTERTAINMENT','HEALTH','SHOPPING','SUBSCRIPTIONS','OTHER'];
const COLORS = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];

export default function DashboardPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [summary, setSummary] = useState({ byCategoryCents: {}, budgetsCents: {}, totalCents: 0 });
  const [timeline, setTimeline] = useState([]);

  async function load() {
    const s = await axios.get('/api/analytics/monthly-summary', { params: { month } });
    setSummary(s.data);
    const t = await axios.get('/api/analytics/spending-over-time');
    setTimeline(t.data.map((d)=> ({ month: d.month, amount: (d.cents/100) })));
  }
  useEffect(()=>{ load(); }, [month]);

  const pieData = CATS.map((c, i)=> ({ name: c, value: (summary.byCategoryCents?.[c]||0)/100, fill: COLORS[i] }))
    .filter(x=>x.value>0);
  const budgetVsActual = CATS.map((c)=> ({ category: c, budget: (summary.budgetsCents?.[c]||0)/100, actual: (summary.byCategoryCents?.[c]||0)/100 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label>Month:</label>
        <input type="month" className="border rounded px-3 py-2" value={month} onChange={e=>setMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Monthly Breakdown</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} outerRadius={120}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Spending Over Time</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" name="Amount ($)" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Budget vs Actual</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetVsActual}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="budget" name="Budget ($)" fill="#94a3b8" />
              <Bar dataKey="actual" name="Actual ($)" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}