import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { createTestApp } from './helpers/app-setup'

describe('Auth (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/auth/login', () => {
    it('should reject missing body fields with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400)
    })

    it('should reject invalid credentials with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'notexist@example.com', password: 'wrongpass' })
        .expect(401)
    })

    it('should set HttpOnly cookie on valid login', async () => {
      if (!process.env.TEST_ADMIN_EMAIL) return // skip without test credentials

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD })

      expect(res.status).toBe(200)
      const raw = res.headers['set-cookie']
      const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw as string] : []
      expect(cookies.some((c) => c.startsWith('access_token'))).toBe(true)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401)
    })
  })

  describe('Protected routes', () => {
    it('GET /api/dashboard/summary should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .expect(401)
    })

    it('GET /api/units/:unitId/impediments should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/units/fake-unit-id/impediments')
        .expect(401)
    })

    it('GET /api/units/:unitId/kanban/:boardId should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/units/fake-unit-id/kanban/fake-board-id')
        .expect(401)
    })
  })
})
