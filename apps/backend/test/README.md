# Backend test suite

## TL;DR

```bash
# from apps/backend/
npm test               # unit + integration (uses ioredis-mock — no infra)
npm run test:e2e       # e2e (needs Postgres running)
```

## Three test tiers

| Tier | Pattern | Config | Infra needed |
|---|---|---|---|
| **Unit** | `src/**/*.spec.ts` | `jest.config.js` | none — all deps mocked |
| **Integration** | `src/**/*.integration.spec.ts` | `jest.config.js` (same) | ioredis-mock; optional real Redis 5+ |
| **E2E** | `test/*.e2e-spec.ts` | `test/jest-e2e.json` | Postgres + Redis + .env populated |

## Coverage summary (2026-05-23)

Unit + integration suite (`npx jest`):

| Area | File | Tests | Why it matters |
|---|---|---|---|
| EventBus | `shared/events/event-bus.service.spec.ts` | 5 | Plano 17 Fase 1.1 — events actually delivered to subscribers |
| Notify handler | `infrastructure/notifications/handlers/notify-user-requested.handler.spec.ts` | 4 | Pub/sub must not cascade failures upstream |
| Stream consumer | `shared/streams/redis-streams-consumer.service.spec.ts` | 4 | **Fallback when Redis<5** (Windows dev) |
| Stream publisher (integration) | `shared/streams/redis-streams.service.integration.spec.ts` | 5 | Real publish path with ioredis-mock |
| Streams round-trip (integration) | `shared/streams/redis-streams.integration.spec.ts` | 8 | XADD/XLEN basic + consumer groups (skipped on mock) |
| TranscriptionStreamHandler | `transcription/transcription-stream.handler.spec.ts` | 7 | Inbound contract: monolith ← transcription-svc |
| TranscriptionService flag | `transcription/transcription.service.spec.ts` | 5 | Feature flag toggles inline vs Redis Streams dispatch |
| Ports | `shared/ports/ports.spec.ts` | 2 | DI tokens are unique Symbols |
| **Total** | | **40** | |

E2E suite (`npm run test:e2e`):

| Area | File | Tests |
|---|---|---|
| Auth | `test/auth.e2e-spec.ts` | login, cookie, /me, /logout, protected routes |
| Impediments | `test/impediments.e2e-spec.ts` | CRUD + escalation |
| **Total** | | **12** |

## Running against real Redis 5+ (optional)

The Redis Streams integration tests use `ioredis-mock` by default. The mock
supports `XADD`, `XLEN`, `XRANGE`, `XREAD` but **NOT** `XGROUP`/`XREADGROUP`,
so consumer-group tests are silently skipped.

To exercise the full consumer-group path, run against real Redis 5+:

```bash
# Start Redis 7 (docker)
docker run -d --rm --name redis-test -p 6380:6379 redis:7-alpine

# Point the tests at it
REDIS_INTEGRATION=real REDIS_HOST=localhost REDIS_PORT=6380 \
  npx jest redis-streams.integration

docker stop redis-test
```

## Running e2e tests

E2E hits a real Postgres via Prisma + boots the full Nest app. Requires:

```bash
# .env populated (see .env.example) with DATABASE_URL pointing at a test DB
# Optionally TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD for login tests
npm run test:e2e
```

The auth e2e test skips the login assertion when credentials aren't provided.

## Adding new tests

- Co-locate `*.spec.ts` next to the source file (unit test).
- Suffix `.integration.spec.ts` when the test exercises a real adapter
  (Redis, Anthropic stub, etc.).
- Put e2e tests in `test/` with `.e2e-spec.ts` suffix — they boot the
  AppModule, which is slow.

## Why ioredis-mock and not Redis container by default?

- Zero install / zero daemon for `npm test`
- CI on Windows/Mac without Docker still passes
- Trade-off: consumer groups aren't covered by `npm test`; covered manually
  via the real-Redis path above (and by production deploy itself).
