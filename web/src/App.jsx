import { useState } from 'react';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const [active, setActive] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Spending Tracker</h1>
          <nav className="flex gap-3">
            <button onClick={() => setActive('dashboard')} className={`px-3 py-2 rounded ${active==='dashboard'?'bg-blue-600 text-white':'hover:bg-gray-100'}`}>Dashboard</button>
            <button onClick={() => setActive('transactions')} className={`px-3 py-2 rounded ${active==='transactions'?'bg-blue-600 text-white':'hover:bg-gray-100'}`}>Transactions</button>
            <button onClick={() => setActive('budgets')} className={`px-3 py-2 rounded ${active==='budgets'?'bg-blue-600 text-white':'hover:bg-gray-100'}`}>Budgets</button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {active === 'dashboard' && <DashboardPage />}
        {active === 'transactions' && <TransactionsPage />}
        {active === 'budgets' && <BudgetsPage />}
      </main>
    </div>
  );
}

export default App;
