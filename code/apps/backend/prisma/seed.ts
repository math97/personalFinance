import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DEFAULT_CATEGORIES = [
  { name: 'Groceries',     color: '#34d399' },
  { name: 'Restaurants',   color: '#fb923c' },
  { name: 'Transport',     color: '#38bdf8' },
  { name: 'Subscriptions', color: '#c084fc' },
  { name: 'Rent',          color: '#818cf8' },
  { name: 'Health',        color: '#2dd4bf' },
  { name: 'Shopping',       color: '#f472b6' },
  { name: 'Food Delivery',  color: '#f43f5e' },
  { name: 'Other',          color: '#6b7280' },
]

async function main() {
  for (const cat of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }
  console.log('Seeded 9 default categories')
}

main().finally(() => db.$disconnect())
