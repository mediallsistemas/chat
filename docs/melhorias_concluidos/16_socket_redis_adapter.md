# 16 — Socket.IO Redis Adapter (Escalabilidade Horizontal)
**Prioridade:** 🟠 Alta — antes de escalar para múltiplos pods
**Tempo estimado:** 3h
**Área:** Escalabilidade

---

## Problema

Com uma única instância NestJS tudo funciona. Com 2+ instâncias (Docker Swarm, Kubernetes), cada pod tem seu próprio Socket.IO em memória. Um usuário conectado ao Pod A não recebe eventos emitidos pelo Pod B — chat e notificações em tempo real param de funcionar.

---

## Implementação

### 1. Instalar pacotes

```bash
cd apps/backend
npm i @socket.io/redis-adapter redis
```

### 2. Configurar adapter no Gateway

```typescript
// apps/backend/src/infrastructure/gateway/app.gateway.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { Logger } from '@nestjs/common'

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ['websocket', 'polling'],
})
export class AppGateway implements OnGatewayInit {
  private readonly logger = new Logger(AppGateway.name)

  @WebSocketServer()
  server: Server

  async afterInit(server: Server) {
    const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`

    try {
      const pubClient = createClient({ url: redisUrl })
      const subClient = pubClient.duplicate()

      await Promise.all([pubClient.connect(), subClient.connect()])

      server.adapter(createAdapter(pubClient, subClient))

      this.logger.log('Socket.IO Redis adapter configured — horizontal scaling enabled')
    } catch (err) {
      this.logger.error('Failed to connect Redis adapter — using in-memory adapter (single instance only)', err)
      // Continua funcionando com adapter em memória se Redis falhar
    }
  }
}
```

### 3. Verificar que eventos são emitidos corretamente

Com o Redis adapter, `server.to(roomId).emit()` funciona entre pods automaticamente. Não requer mudança no código dos eventos — apenas a configuração do adapter.

```typescript
// Funciona em qualquer pod com Redis adapter:
this.server.to(`group:${groupId}`).emit('message:new', message)
this.server.to(`unit:${unitId}`).emit('notification:new', notification)
```

### 4. Configurar variáveis de ambiente

```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=   # Se Redis tem senha configurada
```

### 5. Atualizar docker-compose.yml

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes  # Persistência
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  nestjs:
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      redis:
        condition: service_healthy
```

### 6. Para múltiplas instâncias com Docker Swarm

```yaml
# docker-compose.prod.yml
services:
  nestjs:
    deploy:
      replicas: 3          # 3 instâncias em paralelo
      update_config:
        parallelism: 1     # Atualizar uma de cada vez
        delay: 10s
    environment:
      REDIS_HOST: redis
```

### 7. Testar

```bash
# Iniciar 2 instâncias localmente em portas diferentes
PORT=4000 npm run start:dev &
PORT=4001 npm run start:dev &

# Conectar ao pod A, enviar mensagem
# Verificar que pod B recebe o evento via Redis pub/sub
redis-cli monitor  # Mostra todos os eventos passando pelo Redis
```

---

## Impacto

Sem o adapter:
- 1 instância → funciona
- 2+ instâncias → chat e notificações quebram

Com o adapter:
- N instâncias → tudo funciona transparentemente

---

## Arquivos modificados
- `apps/backend/package.json` — @socket.io/redis-adapter, redis
- `apps/backend/src/infrastructure/gateway/app.gateway.ts` — implementar afterInit com createAdapter
- `docker-compose.yml` — Redis com persistência e healthcheck
