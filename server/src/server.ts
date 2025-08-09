import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PrismaClient, Category } from '@prisma/client';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const app = express();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Create transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { date, description, amount, category } = req.body as {
      date: string; description: string; amount: number; category?: Category | string;
    };

    if (!date || !description || typeof amount !== 'number') {
      return res.status(400).json({ error: 'date, description, amount are required' });
    }

    const detectedCategory = category ?? detectCategory(description);

    const tx = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description,
        amountCents: Math.round(amount * 100),
        category: normalizeCategory(detectedCategory),
        source: 'manual',
      },
    });

    res.json(tx);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// List transactions (optionally by month)
app.get('/api/transactions', async (req, res) => {
  try {
    const { month } = req.query as { month?: string }; // YYYY-MM
    let where: any = {};
    if (month) {
      const [y, m] = month.split('-').map((v) => parseInt(v, 10));
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      where.date = { gte: start, lte: end };
    }
    const txs = await prisma.transaction.findMany({ where, orderBy: { date: 'desc' } });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Upload CSV
app.post('/api/transactions/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const filePath = req.file.path;

  const records: any[] = [];
  fs.createReadStream(filePath)
    .pipe(parse({ columns: true, trim: true }))
    .on('data', (row) => {
      records.push(row);
    })
    .on('end', async () => {
      try {
        // Expect columns: date, description, amount
        const data = await prisma.$transaction(
          records.map((r) =>
            prisma.transaction.create({
              data: {
                date: new Date(r.date),
                description: r.description,
                amountCents: Math.round(parseFloat(r.amount) * 100),
                category: normalizeCategory(detectCategory(r.description)),
                source: 'csv',
              },
            })
          )
        );
        fs.unlinkSync(filePath);
        res.json({ imported: data.length });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to import CSV' });
      }
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to read CSV' });
    });
});

// Budgets
app.get('/api/budgets', async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month) return res.status(400).json({ error: 'month query param required as YYYY-MM' });
    const monthStart = monthStartDate(month);
    const budgets = await prisma.budget.findMany({ where: { month: monthStart } });
    res.json(budgets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const { month, items } = req.body as { month: string; items: { category: Category | string; amount: number }[] };
    if (!month || !Array.isArray(items)) return res.status(400).json({ error: 'month and items required' });
    const monthStart = monthStartDate(month);
    const ops = items.map((it) =>
      prisma.budget.upsert({
        where: { month_category: { month: monthStart, category: normalizeCategory(it.category) } },
        create: { month: monthStart, category: normalizeCategory(it.category), amountCents: Math.round(it.amount * 100) },
        update: { amountCents: Math.round(it.amount * 100) },
      })
    );
    const updated = await prisma.$transaction(ops);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upsert budgets' });
  }
});

// Aggregations
app.get('/api/analytics/monthly-summary', async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month) return res.status(400).json({ error: 'month required YYYY-MM' });
    const [start, end] = monthRange(month);

    const txs = await prisma.transaction.findMany({ where: { date: { gte: start, lte: end } } });

    const byCategory: Record<string, number> = {};
    for (const tx of txs) {
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amountCents;
    }

    const budgets = await prisma.budget.findMany({ where: { month: monthStartDate(month) } });
    const budgetMap: Record<string, number> = {};
    for (const b of budgets) budgetMap[b.category] = b.amountCents;

    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);

    res.json({
      totalCents: total,
      byCategoryCents: byCategory,
      budgetsCents: budgetMap,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute monthly summary' });
  }
});

app.get('/api/analytics/spending-over-time', async (_req, res) => {
  try {
    // group by month
    const txs = await prisma.transaction.findMany({ orderBy: { date: 'asc' } });
    const byMonth: Record<string, number> = {};
    for (const tx of txs) {
      const k = formatMonth(tx.date);
      byMonth[k] = (byMonth[k] ?? 0) + tx.amountCents;
    }
    const series = Object.entries(byMonth).sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, cents]) => ({ month, cents }));
    res.json(series);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute spending over time' });
  }
});

// Utilities
function formatMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthStartDate(ym: string): Date {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
}

function monthRange(ym: string): [Date, Date] {
  const start = monthStartDate(ym);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));
  return [start, end];
}

function normalizeCategory(input: string | Category): Category {
  if (typeof input !== 'string') return input;
  const upper = input.toUpperCase();
  if (upper in Category) return (upper as unknown) as Category;
  switch (upper) {
    case 'HOUSING':
    case 'RENT':
      return Category.HOUSING;
    case 'GROCERIES':
    case 'GROCERY':
    case 'SUPERMARKET':
      return Category.GROCERIES;
    case 'TRANSPORTATION':
    case 'TRANSIT':
    case 'GAS':
    case 'FUEL':
    case 'UBER':
    case 'LYFT':
      return Category.TRANSPORTATION;
    case 'DINING':
    case 'RESTAURANTS':
    case 'RESTAURANT':
    case 'FOOD':
      return Category.DINING;
    case 'UTILITIES':
    case 'ELECTRIC':
    case 'WATER':
    case 'INTERNET':
    case 'PHONE':
      return Category.UTILITIES;
    case 'ENTERTAINMENT':
    case 'MOVIES':
    case 'GAMES':
    case 'MUSIC':
      return Category.ENTERTAINMENT;
    case 'HEALTH':
    case 'MEDICAL':
    case 'PHARMACY':
      return Category.HEALTH;
    case 'SHOPPING':
    case 'RETAIL':
    case 'AMAZON':
      return Category.SHOPPING;
    case 'SUBSCRIPTIONS':
    case 'SUBSCRIPTION':
    case 'NETFLIX':
    case 'SPOTIFY':
    case 'HULU':
      return Category.SUBSCRIPTIONS;
    default:
      return Category.OTHER;
  }
}

function detectCategory(description: string): Category {
  const text = description.toLowerCase();
  const has = (s: string) => text.includes(s);
  if (has('rent') || has('mortgage')) return Category.HOUSING;
  if (has('grocery') || has('supermarket') || has('whole foods') || has('trader joe')) return Category.GROCERIES;
  if (has('gas') || has('uber') || has('lyft') || has('metro') || has('train') || has('bus')) return Category.TRANSPORTATION;
  if (has('restaurant') || has('cafe') || has('dining') || has('bar') || has('grill')) return Category.DINING;
  if (has('electric') || has('water') || has('internet') || has('verizon') || has('comcast')) return Category.UTILITIES;
  if (has('movie') || has('cinema') || has('game') || has('concert')) return Category.ENTERTAINMENT;
  if (has('pharmacy') || has('clinic') || has('hospital') || has('health')) return Category.HEALTH;
  if (has('amazon') || has('target') || has('walmart') || has('mall')) return Category.SHOPPING;
  if (has('subscription') || has('netflix') || has('spotify') || has('hulu') || has('prime')) return Category.SUBSCRIPTIONS;
  return Category.OTHER;
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});