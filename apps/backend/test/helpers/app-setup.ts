import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from '../../src/app.module'

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleFixture.createNestApplication()
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )

  await app.init()
  return app
}

export async function loginAsAdmin(
  app: INestApplication,
  request: (typeof import('supertest'))['default'],
): Promise<{ cookie: string; token: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD })
    .expect(200)

  const cookie = res.headers['set-cookie']?.[0] ?? ''
  return { cookie, token: res.body?.data?.accessToken ?? '' }
}
