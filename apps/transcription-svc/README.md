# transcription-svc

Standalone worker that processes meeting transcriptions with Anthropic Claude.

## Why a separate service?

Per `docs/17_PLANO_MODULAR_MONOLITH.md` Fase 2: transcription has the lowest
cross-context coupling and the heaviest workload (LLM calls take seconds to
minutes). Extracting it lets the monolith stay responsive while transcription
work scales horizontally.

## Architecture

```
monolith                    Redis Streams                   transcription-svc
   │                              │                                │
   ├─ publish TranscriptionRequested ───────► stream:transcription.requested
   │                                                               │
   │                                                               ├─ consume
   │                                                               ├─ HTTP GET /internal/v1/meetings/:id ◄──┐
   │                                                               ├─ call Anthropic                      │
   │  stream:transcription.completed ◄──── publish ─────────────── ┤                                      │
   │  stream:notifications.notify_user ◄── publish ─────────────── ┘                                      │
   │                                                                                                      │
   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Communication:
- **Async (Redis Streams)** — event bus, fire-and-forget with consumer groups
- **Sync (HTTP)** — only `GET /internal/v1/meetings/:id` from svc to monolith
  for metadata lookup; gated by `x-internal-token` header

## Environment

| Var | Required | Default |
|---|---|---|
| `REDIS_HOST` | no | `localhost` |
| `REDIS_PORT` | no | `6379` |
| `REDIS_PASSWORD` | no | - |
| `ANTHROPIC_API_KEY` | yes | - |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-6` |
| `MONOLITH_INTERNAL_URL` | no | `http://nestjs:4000` |
| `MONOLITH_INTERNAL_TOKEN` | yes | - |
| `CONSUMER_NAME` | no | `transcription-${pid}` |
| `POLL_BLOCK_MS` | no | `5000` |
| `LOG_LEVEL` | no | `info` |

## Local dev

```bash
# from monorepo root
docker compose up -d redis
ANTHROPIC_API_KEY=... MONOLITH_INTERNAL_TOKEN=dev-token \
  npm run dev --workspace=transcription-svc
```

## Production

Built and run via `docker-compose.yml` at the monorepo root (service name
`transcription-svc`). Scale with `docker compose up -d --scale transcription-svc=3`
— Redis Streams consumer groups distribute load across replicas.

## Failure handling

- Event schema invalid → log + skip (DLQ candidate, not yet implemented)
- Anthropic API error → publish `TranscriptionFailed`, ack message
- Network/Redis error during processing → no ack, message stays in PEL for
  redelivery by next pending claim cycle
- After `MAX_RETRIES` retries (default 3): move to dead-letter stream (TODO)
