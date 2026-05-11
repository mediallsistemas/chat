# 13 — LGPD: Modelo de Consentimento
> ⚠️ **Dependência:** Fazer APÓS o plano 07 (Winston) — o Logger já deve existir em `notifications.service.ts`. Os planos 14 e 15 dependem deste. Modifica `schema.prisma` — executar migration antes de seguir para o 14.
**Prioridade:** 🔴 Crítico — risco legal
**Tempo estimado:** 3h
**Área:** LGPD / Compliance

---

## Base Legal

Art. 7º e Art. 8º da Lei 13.709/2018 (LGPD) — o tratamento de dados pessoais requer consentimento do titular, que deve ser livre, informado, inequívoco e registrado.

---

## Implementação

### 1. Adicionar modelo ao schema.prisma

```prisma
// apps/backend/prisma/schema.prisma

enum ConsentType {
  DATA_PROCESSING       // Tratamento de dados para operação do sistema
  PUSH_NOTIFICATIONS    // Envio de notificações push
  EMAIL_COMMUNICATIONS  // Comunicações por e-mail
  ANALYTICS             // Uso de dados para melhoria do sistema
}

model UserConsent {
  id          String      @id @default(uuid())
  userId      String      @map("user_id")
  type        ConsentType
  accepted    Boolean
  ip          String?
  userAgent   String?
  version     String      @default("1.0") // Versão da política de privacidade
  acceptedAt  DateTime    @default(now()) @map("accepted_at")
  revokedAt   DateTime?   @map("revoked_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, type, version])
  @@index([userId])
  @@map("user_consents")
}
```

Adicionar relação em User:
```prisma
model User {
  // ... campos existentes
  consents UserConsent[]
}
```

### 2. Criar ConsentsModule

```typescript
// apps/backend/src/consents/consents.service.ts
@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getConsents(userId: string) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    })
  }

  async upsertConsent(
    userId: string,
    type: ConsentType,
    accepted: boolean,
    meta: { ip?: string; userAgent?: string },
  ) {
    return this.prisma.userConsent.upsert({
      where: { userId_type_version: { userId, type, version: '1.0' } },
      create: {
        userId,
        type,
        accepted,
        ip: meta.ip,
        userAgent: meta.userAgent,
        revokedAt: accepted ? null : new Date(),
      },
      update: {
        accepted,
        revokedAt: accepted ? null : new Date(),
      },
    })
  }

  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const consent = await this.prisma.userConsent.findFirst({
      where: { userId, type, accepted: true, revokedAt: null },
    })
    return !!consent
  }
}
```

```typescript
// apps/backend/src/consents/consents.controller.ts
@Controller('units/:unitId/consents')
export class ConsentsController extends BaseUnitController {
  constructor(private readonly consentsService: ConsentsService) { super() }

  @Get('me')
  getMyConsents(@GetUser() user: JwtPayload) {
    return this.consentsService.getConsents(user.sub)
  }

  @Post('me')
  updateConsent(
    @GetUser() user: JwtPayload,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    return this.consentsService.upsertConsent(user.sub, dto.type, dto.accepted, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
  }
}
```

### 3. Usar consentimento antes de enviar push/email

```typescript
// apps/backend/src/notifications/notifications.service.ts
async create(dto: CreateNotificationDto) {
  // ... criar notificação in-app (sempre)

  // Email — verificar consentimento
  const hasEmailConsent = await this.consentsService.hasConsent(
    dto.userId, ConsentType.EMAIL_COMMUNICATIONS
  )
  if (hasEmailConsent && settings.emailEnabled) {
    await this.mailService.sendNotificationEmail(...)
  }

  // Push — verificar consentimento
  const hasPushConsent = await this.consentsService.hasConsent(
    dto.userId, ConsentType.PUSH_NOTIFICATIONS
  )
  if (hasPushConsent && settings.pushEnabled) {
    await this.pushService.sendPush(...)
  }
}
```

### 4. Frontend — tela de consentimento no primeiro acesso

```typescript
// apps/frontend/src/app/(auth)/configuracoes/privacidade/page.tsx
// Página onde usuário gerencia seus consentimentos

// Também mostrar modal no primeiro login:
// Se usuário não tem consentimento DATA_PROCESSING registrado → exibir modal obrigatório
```

### 5. Adicionar ao .env.example

```env
# Versão atual da política de privacidade (atualizar quando política mudar)
PRIVACY_POLICY_VERSION=1.0
```

---

## Arquivos criados/modificados
- `apps/backend/prisma/schema.prisma` — modelo UserConsent + enum ConsentType
- `apps/backend/src/consents/consents.service.ts` — novo
- `apps/backend/src/consents/consents.controller.ts` — novo
- `apps/backend/src/consents/consents.module.ts` — novo
- `apps/backend/src/notifications/notifications.service.ts` — verificar consentimento antes de enviar
- Nova migration Prisma
