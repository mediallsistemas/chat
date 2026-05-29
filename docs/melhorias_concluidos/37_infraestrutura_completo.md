---
name: infraestrutura-completo
description: Módulo 01 — Infraestrutura: código e Docker completos; itens de provisioning de servidor (UFW, DNS, SSL, Nginx, backup) pendentes de execução no servidor de produção
metadata:
  type: project
---

# Plano 01 — Infraestrutura: Concluído (código)

## O que foi implementado

### Docker Compose
- Todos os serviços: NestJS, Next.js, PostgreSQL, Redis, MinIO, Nginx
- Containers sem privilégios de root
- Variáveis de ambiente via `.env`

### Segurança de containers
- MinIO com buckets privados — acesso via signed URLs com expiração
- Redis apenas na rede interna Docker

### Configuração de ambiente
- `.env` e `.env.example` com todas as variáveis documentadas
- `DB_SYNCHRONIZE=false` no código (Prisma migrate deploy)

## Pendente (operacional — requer servidor de produção)

Estes itens são tarefas de provisionamento de servidor, não código:
- Provisionar servidor Ubuntu 24.04
- Configurar UFW (firewall)
- Configurar SSH com chave pública
- Configurar domínio DNS
- Emitir certificado SSL via Certbot
- Configurar Nginx como reverse proxy
- Configurar backup automático do PostgreSQL
- Validar `DB_SYNCHRONIZE=false` em produção
