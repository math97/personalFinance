import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'
import { createCategory, createTransaction } from './helpers/factories'

describe('Transactions (e2e)', () => {
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

  describe('POST /api/transactions', () => {
    it('creates a transaction and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/transactions')
        .send({ description: 'Grocery run', amount: -75.5, date: '2026-04-15', source: 'manual' })
        .expect(201)

      expect(res.body).toMatchObject({ description: 'Grocery run', amount: -75.5 })
      expect(res.body.id).toBeDefined()
    })
  })

  describe('GET /api/transactions', () => {
    it('returns paginated list', async () => {
      await createTransaction(prisma, { description: 'Tx A' })
      await createTransaction(prisma, { description: 'Tx B' })

      const res = await request(app.getHttpServer())
        .get('/api/transactions?page=1&perPage=10')
        .expect(200)

      expect(res.body.items).toHaveLength(2)
      expect(res.body.total).toBe(2)
    })

    it('filters by search term', async () => {
      await createTransaction(prisma, { description: 'Netflix subscription' })
      await createTransaction(prisma, { description: 'Grocery store' })

      const res = await request(app.getHttpServer())
        .get('/api/transactions?search=netflix')
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].description).toBe('Netflix subscription')
    })

    it('filters by categoryId', async () => {
      const cat = await createCategory(prisma, { name: 'Food', color: '#10b981' })
      await createTransaction(prisma, { description: 'Pizza', categoryId: cat.id })
      await createTransaction(prisma, { description: 'Bus ticket' })

      const res = await request(app.getHttpServer())
        .get(`/api/transactions?categoryId=${cat.id}`)
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].description).toBe('Pizza')
    })
  })

  describe('PATCH /api/transactions/:id', () => {
    it('updates the description', async () => {
      const tx = await createTransaction(prisma, { description: 'Old name' })

      const res = await request(app.getHttpServer())
        .patch(`/api/transactions/${tx.id}`)
        .send({ description: 'New name' })
        .expect(200)

      expect(res.body.description).toBe('New name')
    })
  })

  describe('DELETE /api/transactions/:id', () => {
    it('removes the transaction', async () => {
      const tx = await createTransaction(prisma)

      await request(app.getHttpServer()).delete(`/api/transactions/${tx.id}`).expect(200)

      const res = await request(app.getHttpServer()).get('/api/transactions').expect(200)
      expect(res.body.items).toHaveLength(0)
    })
  })
})
