# Plano 01 — Infraestrutura
## Servidor, Docker, Nginx, SSL, Banco de Dados

---

## Objetivo
Provisionar o ambiente de produção completo antes de qualquer desenvolvimento de aplicação.

---

## Servidor Recomendado (MVP)

| Componente | Especificação |
|-----------|--------------|
| CPU | Ryzen 7 / Ryzen 9 (8+ cores) |
| RAM | 32 GB DDR4 |
| Storage Principal | NVMe 1TB |
| Storage Secundário | HD 4TB RAID 1 (arquivos MinIO, gravações) |
| Rede | 1 Gbps |
| SO | Ubuntu Server 24.04 LTS |

---

## Estrutura de Repositório (Monorepo)

O projeto usa um monorepo com Turborepo. O Docker Compose faz build de cada app a partir da sua subpasta:

```
mediall/                 ← raiz do repositório
├── apps/
│   ├── backend/         ← contexto do Docker para nestjs
│   └── frontend/        ← contexto do Docker para nextjs
├── packages/types/
├── turbo.json
└── docker-compose.yml   ← na raiz, referencia apps/* como contexto
```

---

## Serviços Docker Compose

```yaml
services:
  nginx:
    # Proxy reverso, SSL termination
    # Único serviço exposto externamente (443)

  nextjs:
    # Frontend
    # build context: ./apps/frontend
    # Porta interna: 3000

  nestjs:
    # API + WebSocket
    # build context: ./apps/backend
    # Porta interna: 4000

  postgres:
    # Banco principal
    # Porta interna: 5432
    # Volume persistente obrigatório

  redis:
    # Cache, filas, pub/sub WebSocket
    # Porta interna: 6379
    # Volume persistente obrigatório

  minio:
    # Object storage
    # Porta API interna: 9000
    # Porta Console interna: 9001
    # Volume persistente obrigatório

  livekit:
    # Servidor de videochamadas
    # Porta HTTP: 7880
    # Portas UDP WebRTC: 7881/7882
```

---

## Nginx — Configurações Obrigatórias

- HTTPS obrigatório em todos os endpoints
- Redirect HTTP → HTTPS
- HSTS habilitado
- SPA fallback: `try_files $uri /index.html`
- Cache 1 ano para assets estáticos
- Gzip habilitado
- Headers de segurança: `X-Frame-Options`, `X-Content-Type-Options`
- Rate limiting: máximo 100 req/min por IP no login

---

## SSL

- Let's Encrypt via Certbot
- Renovação automática
- Certificado Wildcard se houver subdomínios por unidade

---

## Banco de Dados

- PostgreSQL 16+
- Prisma Migrate para versionamento de schema
- `DB_SYNCHRONIZE=true` **BLOQUEADO** em produção
- Backup automático diário às 3h:
  - Dump PostgreSQL
  - Snapshot MinIO
  - Destino: storage externo

---

## Firewall (UFW)

```bash
# Apenas estas portas expostas externamente
ufw allow 80    # redirect para 443
ufw allow 443   # HTTPS
ufw allow 22    # SSH (apenas chave pública)
```

---

## SSH

- Apenas autenticação por chave pública
- Desabilitar autenticação por senha
- Porta padrão pode ser alterada para segurança adicional

---

## Segurança de Containers

- Containers Docker sem privilégios de root
- MinIO com buckets privados
- Acesso a arquivos via signed URLs com expiração

---

## Checklist de Setup

- [ ] Provisionar servidor Ubuntu 24.04
- [x] Instalar Docker + Docker Compose
- [ ] Configurar UFW
- [ ] Configurar SSH com chave pública
- [x] Clonar repositório
- [x] Configurar variáveis de ambiente (`.env`)
- [x] Subir serviços com Docker Compose
- [ ] Configurar domínio DNS
- [ ] Emitir certificado SSL (Certbot)
- [ ] Configurar Nginx
- [ ] Testar HTTPS end-to-end
- [ ] Configurar backup automático
- [ ] Validar que `DB_SYNCHRONIZE=false` em produção
