import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { createTestApp, loginAsAdmin } from './helpers/app-setup'

describe('Impediments (e2e)', () => {
  let app: INestApplication
  let cookie: string
  let unitId: string

  beforeAll(async () => {
    app = await createTestApp()

    // All tests requiring auth are skipped without test credentials
    if (!process.env.TEST_ADMIN_EMAIL) return

    const session = await loginAsAdmin(app, request)
    cookie = session.cookie

    // Resolve active unit from /api/units
    const unitsRes = await request(app.getHttpServer())
      .get('/api/units')
      .set('Cookie', cookie)

    unitId = unitsRes.body?.data?.[0]?.id
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/units/:unitId/impediments', () => {
    it('requires auth', async () => {
      await request(app.getHttpServer())
        .get('/api/units/fake/impediments')
        .expect(401)
    })

    it('returns list with valid auth', async () => {
      if (!cookie || !unitId) return

      const res = await request(app.getHttpServer())
        .get(`/api/units/${unitId}/impediments`)
        .set('Cookie', cookie)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
    })
  })

  describe('GET /api/units/:unitId/impediments/analytics', () => {
    it('returns analytics structure', async () => {
      if (!cookie || !unitId) return

      const res = await request(app.getHttpServer())
        .get(`/api/units/${unitId}/impediments/analytics`)
        .set('Cookie', cookie)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        blocked: expect.any(Number),
        attention: expect.any(Number),
        resolvedLast30: expect.any(Number),
        avgResolutionHours: expect.any(Number),
        byEscalationLevel: expect.any(Array),
        topAssignees: expect.any(Array),
      })
    })
  })

  describe('GET /api/units/:unitId/reports/impediments/pdf', () => {
    it('returns a PDF buffer', async () => {
      if (!cookie || !unitId) return

      const res = await request(app.getHttpServer())
        .get(`/api/units/${unitId}/reports/impediments/pdf`)
        .set('Cookie', cookie)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('application/pdf')
    })
  })
})
