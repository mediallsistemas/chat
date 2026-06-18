# Plano 17 — Fase 3: Guia de observação (decisão go/no-go)

> Status: ativo
> Pré-requisito: Fase 2 (transcription-svc) deployado em produção e processando
> Próximo passo: decisão sobre Fase 4 baseada em métricas reais

## Por que esta fase existe

A premissa do plano 17 é não extrair micro-serviços sem dor mensurável. A Fase 3
existe pra coletar dados reais durante ~1 semana após o transcription-svc estar
em produção, e decidir se vale a pena seguir pra Fase 4 (extrair meetings/chat).

Decisão deve ser baseada em métricas, não em opinião.

---

## O que medir

### 1. Carga do monolito antes/depois da extração

**Antes da extração:**
- CPU médio do container `nestjs` durante picos de transcrição (3 reuniões processando)
- Tempo de resposta P95 de outras rotas durante esses picos
- Eventos de eviction de memória, OOM kills, gc pauses

**Depois da extração:**
- Mesmas métricas
- CPU do container `transcription-svc` (deve absorver a carga que estava no monolito)

**Critério de sucesso:** P95 das rotas não-transcription melhora em ≥30% durante picos.

**Onde coletar:** `docker stats`, Grafana se já tiver. Sem dashboard, salvar
output de `docker stats` em arquivo por 24h via cron.

### 2. Throughput e latência da fila Redis Streams

Métricas a expor (queries Redis):

```bash
# Pendência por consumer group
redis-cli XPENDING stream:transcription.requested.v1 transcription-svc-requested

# Tamanho do stream
redis-cli XLEN stream:transcription.requested.v1

# Idle time da mensagem mais antiga não-acked
redis-cli XPENDING stream:transcription.requested.v1 transcription-svc-requested - + 1
```

Alertas a configurar:
- Pendência > 50 mensagens por mais de 5 minutos → svc travado ou lento
- Idle time > 10 minutos → mensagem possivelmente perdida (precisa XCLAIM)
- Stream length crescente sem queda em janelas de 1h → consumer não está acompanhando

### 3. Custo operacional adicional

Em horas/semana, registrar:
- Tempo gasto operando o segundo container (deploy, logs, debugging)
- Quantos incidentes envolveram comunicação cross-service
- Quanto tempo para diagnosticar (correlation IDs ajudaram? Faltou algo?)

**Critério go/no-go:** se >4h/semana são gastas só em manter o setup distribuído,
a Fase 4 (extrair mais serviços) provavelmente vai consumir o resto do tempo.

### 4. Erros e DLQ

- Quantas mensagens vão pra dead-letter (XPENDING com idle time alto)
- Quantas vezes XACK falha
- Quantos eventos com schema inválido (parser Zod falhou) — sinal de versão desatualizada

### 5. Tempo de processamento de transcrição

Logs do `transcription-svc` devem registrar tempo Anthropic API + tempo total.

```
{level: 'info', service: 'transcription-svc', event: 'transcription.completed',
 meetingId: '...', anthropicMs: 12500, totalMs: 14200}
```

**Critério:** processamento >2x mais lento do que era no monolito sugere overhead
de I/O (rede, MinIO) que não vale a pena.

---

## Como coletar (low-effort, sem stack nova)

### Opção 1: logs estruturados + grep
Cada serviço já loga JSON estruturado. Para coletar uma semana:

```bash
# No host de produção
docker logs --since 168h nestjs > /tmp/nestjs.log
docker logs --since 168h transcription-svc > /tmp/svc.log

# Análise rápida
grep '"event":"transcription.completed"' /tmp/svc.log | jq '.totalMs' | awk '{s+=$1; c++} END {print "avg="s/c" count="c}'
```

### Opção 2: dashboard mínimo

Se já houver Grafana/Prometheus, expor `/metrics` em ambos os serviços via
`prom-client`. Caso contrário, **não vale a pena** instalar agora — a opção 1 cobre.

---

## Template do relatório semanal

Preencher após 7 dias de operação:

```markdown
## Semana de YYYY-MM-DD — relatório de observação Fase 3

### Carga
- Pico de uso do nestjs (CPU/mem): ___
- Pico do transcription-svc: ___
- P95 das rotas não-transcription melhorou em ___% durante picos
- OOM kills observados: ___

### Streams
- Pendência média: ___
- Pendência máxima atingida: ___
- Mensagens em DLQ: ___
- Schema validation failures: ___

### Operacional
- Horas gastas em operação distribuída: ___
- Incidentes cross-service: ___
- Tempo médio de diagnóstico: ___

### Performance transcription
- Tempo médio antes (monolito): ___
- Tempo médio agora (svc): ___
- Diferença: ___%

### Decisão
[ ] Manter como está (Fase 4 não justificada)
[ ] Prosseguir Fase 4 — extrair meetings+chat
[ ] Reverter — voltar a processar transcription inline
```

---

## Sinais de que devo reverter

- Tempo de processamento aumentou >50% sem motivo claro
- Mensagens travam frequentemente em PEL exigindo intervenção manual
- O ganho operacional do monolito é desprezível (<10% P95)
- Time gasto operando o svc supera o tempo que ele economiza

Reverter é parte do plano. Setar `TRANSCRIPTION_SVC_ENABLED=false` faz o
monolito voltar a processar inline imediatamente; o svc fica parado.

---

## Sinais de que devo prosseguir Fase 4

- transcription-svc estável por ≥1 semana sem incidente operacional
- Ganho mensurável de carga no monolito
- Dor real de escala em chat/meetings (CPU alto, latência socket subindo)
- Confiança que Redis Streams + boundary lint + read ports são suficientes
