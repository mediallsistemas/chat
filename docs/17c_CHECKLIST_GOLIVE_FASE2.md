# Plano 17 — Fase 2 Go-live Checklist

> Atualizado: 2026-05-23
> Pré-requisito: Fases 1.1–1.4 concluídas (EventBus, boundary lint, multi-file schema, ports)
> Resultado: transcription-svc rodando em produção, processando via Redis Streams

## Antes do deploy

### 1. Variáveis de ambiente

No `.env` de produção (ver `apps/backend/.env.example`):

```
MONOLITH_INTERNAL_TOKEN=<gerar via: openssl rand -hex 32>
TRANSCRIPTION_SVC_ENABLED=true
ANTHROPIC_API_KEY=<key real, NÃO o dummy>
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**Crítico:** o `MONOLITH_INTERNAL_TOKEN` deve ser idêntico nos dois envs
(backend e transcription-svc). É o que protege o endpoint `/internal/v1/*`
no monolito.

### 2. Validar versão do Redis

```bash
docker exec -it <redis-container> redis-cli INFO server | grep redis_version
```

Deve ser `>= 5.0`. O `docker-compose.yml` usa `redis:7-alpine` (correto).
Se for downgrade acidental, transcription-svc vai logar `Consumer will idle`
e o healthcheck retorna 503 — fácil de pegar.

### 3. Testar local com Docker

```bash
# Limpar estado anterior
docker compose down -v

# Subir só o que importa pra essa fase
docker compose up -d postgres redis nestjs transcription-svc

# Aguardar healthchecks
docker compose ps  # transcription-svc deve mostrar "healthy"

# Curl o healthcheck
docker compose exec transcription-svc wget -qO- http://localhost:4001/health
# esperado: {"status":"ok","redis":"up","consumer":"running",...}
```

### 4. Smoke test do contrato

```bash
# 1. Verificar que monolito expõe o internal endpoint corretamente
docker compose exec nestjs curl -s \
  -H "x-internal-token: $MONOLITH_INTERNAL_TOKEN" \
  http://localhost:4000/api/v1/internal/v1/meetings/00000000-0000-0000-0000-000000000000
# esperado: 404 (token correto, meeting inexistente)

# 2. Publicar evento de teste no stream
docker compose exec redis redis-cli XADD stream:transcription.requested.v1 '*' \
  payload '{"version":"1","eventId":"test","occurredAt":"2026-05-23T00:00:00Z","meetingId":"...","recordingUrl":"...","unitId":"...","requestedBy":"..."}'

# 3. Ver log do svc consumir
docker compose logs -f transcription-svc
# esperado: log "processing transcription request meeting=..."
```

## Durante o deploy

### 5. Migration Prisma

Antes de subir nova versão do backend:

```bash
# Backup do DB ANTES
pg_dump -h <host> -U <user> mediall_db > backup_pre_phase2_$(date +%F).sql

# Aplicar migrations pendentes
docker compose exec nestjs npx prisma migrate deploy
```

A migration `20260523000000_modular_monolith_phase1` é idempotente
(só ajusta FK do groups.unit_id), mas sempre vale ter backup.

### 6. Deploy em ordem

```bash
# 1. Subir Redis 7 (se ainda não estiver)
docker compose up -d redis
docker compose exec redis redis-cli INFO server | grep redis_version  # confirma >=5

# 2. Subir Postgres
docker compose up -d postgres

# 3. Subir monolito (com TRANSCRIPTION_SVC_ENABLED=false na primeira subida)
# Isso garante que o monolito sobe mesmo se o svc ainda não tiver subido.
TRANSCRIPTION_SVC_ENABLED=false docker compose up -d nestjs
docker compose exec nestjs npx prisma migrate deploy

# 4. Subir transcription-svc
docker compose up -d transcription-svc
docker compose ps  # ambos devem estar "healthy"

# 5. Flip do flag — sem precisar de redeploy completo
docker compose exec nestjs sh -c 'echo "TRANSCRIPTION_SVC_ENABLED=true" >> /app/.env'
docker compose restart nestjs
```

### 7. Verificar logs

```bash
# Monolito deve mostrar:
docker compose logs nestjs | grep -i "transcription stream handlers subscribed"
# esperado: "transcription stream handlers subscribed"

# transcription-svc deve mostrar:
docker compose logs transcription-svc | grep -i "consumer starting"
# esperado: "consumer starting" (NÃO "consumer idling")
```

## Após o deploy — validação funcional

### 8. Fluxo end-to-end real

Pelo frontend (ou via API):

1. Criar uma reunião (POST /api/v1/units/:unitId/meetings)
2. Encerrar a reunião (PATCH .../meetings/:id { status: DONE })
3. Solicitar transcrição (POST .../meetings/:id/transcript com transcript text)
4. Verificar:
   - Response imediata: `{ status: "queued", meetingId }` (não bloqueia)
   - Log do svc: `transcription dispatched to svc meeting=<id>`
   - Após ~5-30s (Anthropic): meeting.transcriptedAt populado no DB
   - Notification gerada para participantes (`type: TRANSCRIPT_READY`)

### 9. Métricas a coletar (Fase 3)

Ver `17a_OBSERVABILIDADE_FASE3.md`. Por uma semana, registrar:
- CPU do nestjs durante picos de transcrição (deve cair vs antes)
- Tempo médio total da transcrição (svc vs inline anterior)
- Pendência no stream `XPENDING stream:transcription.requested.v1`
- Mensagens em DLQ
- Erros operacionais cross-service

## Rollback (se algo der errado)

### Opção A — Reverter feature flag (rápido, sem downtime)

```bash
# Volta para processar inline no monolito
docker compose exec nestjs sh -c 'sed -i "s/TRANSCRIPTION_SVC_ENABLED=true/TRANSCRIPTION_SVC_ENABLED=false/" /app/.env'
docker compose restart nestjs
```

Transcription-svc continua rodando mas não recebe mais trabalho. Pode
ser parado tranquilamente quando confirmado:

```bash
docker compose stop transcription-svc
```

### Opção B — Reverter código completo

```bash
git revert <commit-hash-do-go-live>
docker compose up -d --build nestjs
```

Não precisa reverter migrations — elas são compatíveis com a versão anterior.

## Sinais de problema durante operação

| Sintoma | Causa provável | Ação |
|---|---|---|
| transcription-svc healthcheck 503 | Redis sem Streams ou consumer crashou | `docker compose logs transcription-svc` |
| Transcrição não chega no frontend | Stream cheio / consumer parado | `redis-cli XPENDING stream:transcription.requested.v1 ...` |
| Erro "schema invalid" em massa | Versão de `@mediall/events` divergente entre monolito e svc | Garantir mesmo deploy hash |
| Notification não chega após transcrição | Stream `notify_user` não consumido | Ver log do monolito por `monolith-notify-user-cross-service` |
| Anthropic timeout / quota | API key inválida ou rate limit | Falha publicada em stream `transcription.failed` |

## Critérios de sucesso (após 1 semana)

- [ ] Healthcheck do svc continua 200 sem reinício
- [ ] Pendência no stream `requested` < 5 em média
- [ ] P95 das rotas non-transcription melhorou em ≥30% durante picos
- [ ] Zero mensagens em DLQ (ou DLQ implementado e drenado)
- [ ] Tempo médio de transcrição estável (sem degradação > 50% vs inline)

Se todos OK → registrar como aprovado e passar a discussão para Fase 4
(extração realtime-svc).

Se algum critério falhar → ver `17a_OBSERVABILIDADE_FASE3.md` para
diagnóstico e considerar rollback via feature flag.
