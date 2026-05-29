---
name: roadmap-fases-completo
description: Módulo 14 — Roadmap e Fases: Fases 1-3 completas em código; Fase 4 (mobile, assinaturas, integrações hospitalares, PDI) é roadmap futuro
metadata:
  type: project
---

# Plano 14 — Roadmap e Fases: Concluído (Fases 1–3)

## O que foi entregue

### Fase 1 — Base + Gestão Estratégica
- Auth JWT completo (login, logout, refresh, MFA base)
- Guard stack: JwtAuthGuard → RolesGuard → UnitScopeGuard
- Modelo de dados completo (Prisma schema + migrations)
- Multi-unidade / holding com isolamento por unitId
- Gestão estratégica: Plano → Objetivo → Meta → Etapa → MacroTarefa → Tarefa
- Dashboard consolidado da diretoria com faróis em tempo real
- Frontend Next.js com feature folders

### Fase 2 — Comunicação
- Chat com grupos (GENERAL/SECTOR/PROJECT/TEMPORARY/PRIVATE)
- WebSocket com Redis adapter
- Presença online via Redis
- Upload de arquivos com MinIO + AES-256-GCM para sensíveis
- Notificações in-app + push (Web Push)
- Impedimentos com escalonamento automático

### Fase 3 — Reuniões + Integração total
- Reuniões com LiveKit WebRTC
- Transcrição automática com Whisper
- Relatórios executivos PDF/Excel
- Auditoria completa (AuditLogInterceptor + tabela audit_log)
- LGPD: consentimento, anonimização, retenção de dados

## Pendente (Fase 4 — roadmap futuro)

- Provisionar servidor Ubuntu 24.04 + Docker Compose + Nginx + SSL
- Treinamento dos usuários
- Aplicativo mobile React Native
- Assinaturas digitais internas
- Integrações hospitalares (TASY, MV, etc.)
- PDI e gestão de performance de colaboradores
