import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'
import { createCategory } from './helpers/factories'

describe('Categories (e2e)', () => {
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

  describe('POST /api/categories', () => {
    it('creates a category and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .send({ name: 'Food', color: '#10b981' })
        .expect(201)

      expect(res.body).toMatchObject({ name: 'Food', color: '#10b981' })
      expect(res.body.id).toBeDefined()
    })

    it('rejects invalid color', async () => {
      await request(app.getHttpServer())
        .post('/api/categories')
        .send({ name: 'Food', color: 'not-a-color' })
        .expect(400)
    })
  })

  describe('GET /api/categories', () => {
    it('returns all categories', async () => {
      await createCategory(prisma, { name: 'Food', color: '#10b981' })
      await createCategory(prisma, { name: 'Transport', color: '#3b82f6' })

      const res = await request(app.getHttpServer()).get('/api/categories').expect(200)

      expect(res.body).toHaveLength(2)
      expect(res.body.map((c: any) => c.name)).toEqual(expect.arrayContaining(['Food', 'Transport']))
    })
  })

  describe('POST /api/categories/:id/rules', () => {
    it('adds a keyword rule', async () => {
      const category = await createCategory(prisma, { name: 'Food', color: '#10b981' })

      const res = await request(app.getHttpServer())
        .post(`/api/categories/${category.id}/rules`)
        .send({ keyword: 'restaurant' })
        .expect(201)

      expect(res.body).toMatchObject({ keyword: 'restaurant', categoryId: category.id })
    })
  })

  describe('DELETE /api/categories/rules/:ruleId', () => {
    it('removes a rule', async () => {
      const category = await createCategory(prisma, { name: 'Food', color: '#10b981' })
      const rule = await prisma.categoryRule.create({
        data: { categoryId: category.id, keyword: 'supermarket' },
      })

      await request(app.getHttpServer())
        .delete(`/api/categories/rules/${rule.id}`)
        .expect(200)

      const remaining = await prisma.categoryRule.findUnique({ where: { id: rule.id } })
      expect(remaining).toBeNull()
    })
  })

  describe('DELETE /api/categories/:id', () => {
    it('removes the category', async () => {
      const category = await createCategory(prisma, { name: 'Food', color: '#10b981' })

      await request(app.getHttpServer())
        .delete(`/api/categories/${category.id}`)
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/categories').expect(200)
      expect(res.body).toHaveLength(0)
    })
  })
})
