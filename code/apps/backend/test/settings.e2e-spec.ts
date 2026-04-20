import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'

describe('Settings (e2e)', () => {
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

  describe('GET /api/settings', () => {
    it('returns defaults when no row exists', async () => {
      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(res.body).toHaveProperty('aiProvider')
      expect(res.body).toHaveProperty('aiModel')
      expect(res.body).toHaveProperty('aiApiKeyConfigured')
      expect(res.body.aiApiKeyConfigured).toBe(false)
    })
  })

  describe('PATCH /api/settings', () => {
    it('persists provider and model', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'anthropic', aiApiKey: 'sk-test', aiModel: 'claude-haiku-4-5-20251001' })
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(res.body.aiProvider).toBe('anthropic')
      expect(res.body.aiModel).toBe('claude-haiku-4-5-20251001')
      expect(res.body.aiApiKeyConfigured).toBe(true)
    })

    it('does not return raw API key', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'openrouter', aiApiKey: 'sk-secret-key', aiModel: 'gpt-4o' })
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(JSON.stringify(res.body)).not.toContain('sk-secret-key')
    })

    it('rejects invalid provider', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'invalid', aiApiKey: 'key', aiModel: 'model' })
        .expect(400)
    })
  })

  describe('POST /api/settings/test', () => {
    it('returns ok:false for invalid key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/settings/test')
        .send({ aiProvider: 'openrouter', aiApiKey: 'invalid-key', aiModel: 'google/gemini-2.5-flash-preview' })
        .expect(201)

      expect(res.body.ok).toBe(false)
      expect(res.body.error).toBeDefined()
    })
  })
})
