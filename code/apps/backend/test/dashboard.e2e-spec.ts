import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'
import { createCategory, createTransaction } from './helpers/factories'

describe('Dashboard (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    ;({ app, prisma } = await createTestApp())
  })

  beforeEach(async () => {
    await cleanDb(prisma)
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/dashboard/summary', () => {
    it('returns correct shape on empty DB', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/summary?year=2026&month=4')
        .expect(200)

      expect(res.body).toHaveProperty('summary')
      expect(res.body).toHaveProperty('byCategory')
      expect(res.body).toHaveProperty('monthlyTotals')
      expect(res.body.summary.totalSpent).toBe(0)
      expect(res.body.summary.totalIncome).toBe(0)
    })

    it('reflects seeded transactions', async () => {
      const cat = await createCategory(prisma, { name: 'Food', color: '#10b981' })
      await createTransaction(prisma, {
        description: 'Groceries',
        amount: -80,
        date: new Date('2026-04-10'),
        categoryId: cat.id,
      })
      await createTransaction(prisma, {
        description: 'Salary',
        amount: 3000,
        date: new Date('2026-04-01'),
      })

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/summary?year=2026&month=4')
        .expect(200)

      expect(Number(res.body.summary.totalSpent)).toBeCloseTo(80)
      expect(Number(res.body.summary.totalIncome)).toBeCloseTo(3000)
      expect(res.body.byCategory).toHaveLength(1)
      expect(res.body.byCategory[0].name).toBe('Food')
    })
  })
})
