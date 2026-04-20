import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'
import { createCategory, createImportBatch, createImportedTransaction } from './helpers/factories'

describe('Import (e2e)', () => {
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

  describe('GET /api/import/batches', () => {
    it('returns list of batches', async () => {
      await createImportBatch(prisma, { filename: 'bank.pdf' })

      const res = await request(app.getHttpServer()).get('/api/import/batches').expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].filename).toBe('bank.pdf')
    })
  })

  describe('GET /api/import/batches/:id', () => {
    it('returns batch with imported transactions', async () => {
      const batch = await createImportBatch(prisma)
      await createImportedTransaction(prisma, batch.id, { rawDescription: 'Coffee' })

      const res = await request(app.getHttpServer())
        .get(`/api/import/batches/${batch.id}`)
        .expect(200)

      expect(res.body.id).toBe(batch.id)
      expect(res.body.imported).toHaveLength(1)
      expect(res.body.imported[0].rawDescription).toBe('Coffee')
    })
  })

  describe('PATCH /api/import/transactions/:id', () => {
    it('updates rawDescription', async () => {
      const batch = await createImportBatch(prisma)
      const itx = await createImportedTransaction(prisma, batch.id)

      const res = await request(app.getHttpServer())
        .patch(`/api/import/transactions/${itx.id}`)
        .send({ rawDescription: 'Updated description' })
        .expect(200)

      expect(res.body.rawDescription).toBe('Updated description')
    })
  })

  describe('POST /api/import/transactions/:id/save-rule', () => {
    it('persists a keyword rule on the category', async () => {
      const cat = await createCategory(prisma, { name: 'Food', color: '#10b981' })
      const batch = await createImportBatch(prisma)
      const itx = await createImportedTransaction(prisma, batch.id, { rawDescription: 'Uber Eats' })

      await request(app.getHttpServer())
        .post(`/api/import/transactions/${itx.id}/save-rule`)
        .send({ keyword: 'uber eats', categoryId: cat.id })
        .expect(201)

      const rule = await prisma.categoryRule.findFirst({ where: { categoryId: cat.id } })
      expect(rule?.keyword).toBe('uber eats')
    })
  })

  describe('POST /api/import/batches/:id/confirm', () => {
    it('promotes imported transactions to the transaction table', async () => {
      const batch = await createImportBatch(prisma)
      await createImportedTransaction(prisma, batch.id, { rawDescription: 'Supermarket', rawAmount: -120 })

      await request(app.getHttpServer())
        .post(`/api/import/batches/${batch.id}/confirm`)
        .expect(201)

      const txs = await prisma.transaction.findMany()
      expect(txs).toHaveLength(1)
      expect(txs[0].description).toBe('Supermarket')
    })
  })

  describe('DELETE /api/import/batches/:id', () => {
    it('discards the batch', async () => {
      const batch = await createImportBatch(prisma)

      await request(app.getHttpServer())
        .delete(`/api/import/batches/${batch.id}`)
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/import/batches').expect(200)
      expect(res.body).toHaveLength(0)
    })
  })
})
