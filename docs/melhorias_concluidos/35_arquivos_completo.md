---
name: arquivos-completo
description: Módulo 07 — Módulo de Arquivos completamente implementado (MinIO, signed URLs, versionamento, encriptação AES-256-GCM)
metadata:
  type: project
---

# Plano 07 — Módulo de Arquivos: Concluído

## O que foi implementado

### Upload e armazenamento
- MinIO com buckets privados
- `POST /units/:unitId/upload` — `FileInterceptor`, limite 20 MB
- Chave MinIO prefixada com `unitId/` para isolamento por unidade
- Signed URLs com TTL de 1 hora para download direto

### Encriptação AES-256-GCM para arquivos sensíveis
- `POST /units/:unitId/upload?sensitive=true` → `StorageService.uploadEncrypted()`
  - Gera IV aleatório de 12 bytes, encripta com AES-256-GCM
  - Armazena `[12 bytes IV][16 bytes authTag][ciphertext]` como blob único
  - MIME original salvo em metadata MinIO (`x-amz-meta-original-mime`)
  - Prefixo de chave `enc/` para identificação
- `GET /units/:unitId/download/:key` → `StorageService.downloadDecrypted()`
  - Proxy backend: lê blob, extrai IV + authTag + ciphertext, descriptografa
  - Retorna buffer plaintext com `Content-Type` correto
  - Arquivos encriptados nunca geram signed URLs — acesso sempre via proxy autenticado
- Chave de encriptação: `FILE_ENCRYPTION_KEY` env (hex 64 chars = 32 bytes)

### Versionamento
- Campos `versionOf`, `versionNumber`, `isLatest` no schema Document
- Migration `20260513000001_add_document_versioning`
- Endpoints `uploadVersion` e `listVersions`

### Preview e busca
- Preview inline no `MessageBubble` para imagens
- `GET /units/:unitId/documents/search?name=&mime=&from=&to=`
