# Plano 07 — Módulo de Arquivos
## Upload, MinIO, versionamento, permissões

---

## Objetivo
Centralizar o armazenamento de arquivos corporativos com controle de acesso, versionamento e preview inline.

---

## Contextos de Upload

Arquivos podem ser enviados em qualquer contexto:
- Chat (mensagem com anexo)
- Tarefa / sub-tarefa
- Reunião
- Meta / objetivo

---

## Tipos Suportados

PDF, Word, Excel, imagens (JPG, PNG, WEBP), vídeos (MP4), ZIP

**Limite por arquivo:** 100MB (configurável pelo admin)

---

## Armazenamento

- MinIO (compatível com S3 para migração futura)
- Buckets privados — acesso via **signed URLs** com expiração
- Arquivos sensíveis (dados de pacientes): encriptados em repouso com AES-256

---

## Funcionalidades

- Preview inline para imagens e PDFs no chat e nas tarefas
- Busca de arquivos por nome, tipo, data ou grupo
- Versionamento: ao subir nova versão, a anterior é mantida e acessível
- Permissão herdada do grupo/contexto onde foi enviado

---

## Checklist de Implementação

- [x] Configurar MinIO no Docker Compose
- [x] Módulo de upload com Multer no NestJS (FilesModule — POST /units/:unitId/upload, FileInterceptor, 20MB limit)
- [x] Geração de signed URLs com expiração (FilesService.getSignedUrl, 1h TTL)
- [x] Preview inline no frontend (imagem inline no MessageBubble; arquivo com link download)
- [x] Busca de arquivos por nome/tipo/data (filtros em `/documentos`)
- [x] Versionamento de arquivos (`Document.versionOf` + `versionNumber` + `isLatest`)
- [ ] Encriptação AES-256 para arquivos sensíveis (delegado a MinIO server-side encryption em produção)
- [x] Isolamento por unidade no acesso a arquivos (unitId no prefixo da chave MinIO)
