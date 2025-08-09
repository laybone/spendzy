import { PrismaClient, Category } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const monthIndex = today.getUTCMonth();
  const monthStart = new Date(Date.UTC(yyyy, monthIndex, 1, 0, 0, 0));

  const defaults: { category: Category; amountCents: number }[] = [
    { category: Category.HOUSING, amountCents: 150000 },
    { category: Category.GROCERIES, amountCents: 60000 },
    { category: Category.TRANSPORTATION, amountCents: 30000 },
    { category: Category.DINING, amountCents: 25000 },
    { category: Category.UTILITIES, amountCents: 20000 },
    { category: Category.ENTERTAINMENT, amountCents: 15000 },
    { category: Category.HEALTH, amountCents: 15000 },
    { category: Category.SHOPPING, amountCents: 30000 },
    { category: Category.SUBSCRIPTIONS, amountCents: 15000 },
    { category: Category.OTHER, amountCents: 10000 },
  ];

  for (const b of defaults) {
    await prisma.budget.upsert({
      where: { month_category: { month: monthStart, category: b.category } },
      create: { month: monthStart, category: b.category, amountCents: b.amountCents },
      update: { amountCents: b.amountCents },
    });
  }

  await prisma.transaction.createMany({
    data: [
      { date: new Date(), description: 'Rent - Apartment', amountCents: 150000, category: Category.HOUSING, source: 'manual' },
      { date: new Date(), description: 'Whole Foods Market', amountCents: 8200, category: Category.GROCERIES, source: 'manual' },
      { date: new Date(), description: 'Uber Ride', amountCents: 2300, category: Category.TRANSPORTATION, source: 'manual' },
      { date: new Date(), description: 'Netflix Subscription', amountCents: 1599, category: Category.SUBSCRIPTIONS, source: 'manual' },
      { date: new Date(), description: 'Dinner at Local Grill', amountCents: 4600, category: Category.DINING, source: 'manual' },
    ],
  });

  console.log('Seeded data for current month');
}

main().finally(async () => {
  await prisma.$disconnect();
});