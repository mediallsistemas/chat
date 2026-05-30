# 04 — Guard de Role em Users Controller
**Prioridade:** 🟠 Alta
**Tempo estimado:** 30min
**Área:** Segurança

---

## Problema

`users.controller.ts` não tem restrição de role em `findAll()` e `findOne()`. Qualquer usuário autenticado — incluindo funcionários comuns — pode listar todos os usuários da plataforma, incluindo nomes e e-mails.

---

## Implementação

### 1. Restringir findAll e findOne

```typescript
// apps/backend/src/contexts/users/users.controller.ts
import { Roles } from '@/common/decorators/roles.decorator'
import { UserRole } from '@mediall/types'

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {

  // Listar todos os usuários — apenas admins
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  @Get()
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query)
  }

  // Ver usuário específico — apenas admins (ou o próprio usuário)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: JwtPayload) {
    // Permitir que o usuário veja seus próprios dados
    if (user.sub !== id && ![UserRole.SUPER_ADMIN, UserRole.DIRETORIA].includes(user.role)) {
      throw new ForbiddenException()
    }
    return this.usersService.findOne(id)
  }

  // Criar usuário — apenas super admin
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  // Atualizar — admin ou próprio usuário
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @GetUser() user: JwtPayload) {
    if (user.sub !== id && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException()
    }
    return this.usersService.update(id, dto)
  }

  // Deletar — apenas super admin
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id)
  }
}
```

### 2. Endpoint de perfil próprio (sem restrição de role)

Adicionar endpoint separado para o usuário ver/editar seus próprios dados:

```typescript
// apps/backend/src/contexts/auth/auth.controller.ts
@Get('me')
getMe(@GetUser() user: JwtPayload) {
  return this.usersService.findOne(user.sub)
}

@Patch('me')
updateMe(@GetUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
  return this.usersService.updateProfile(user.sub, dto)
}
```

### 3. Busca de usuários para autocomplete (escopo limitado)

Para features como "atribuir responsável" no Kanban, criar endpoint específico com dados mínimos:

```typescript
// Retorna apenas id + name — sem e-mail, sem role
@Get('search')
search(@Query('q') q: string, @GetUser() user: JwtPayload) {
  // Usuário comum pode buscar dentro da sua unidade
  return this.usersService.searchByName(q, user)
}
```

---

## Arquivos modificados
- `apps/backend/src/contexts/users/users.controller.ts` — adicionar @Roles nos endpoints
- `apps/backend/src/contexts/auth/auth.controller.ts` — adicionar GET /me e PATCH /me
- `apps/backend/src/contexts/users/users.service.ts` — adicionar searchByName() e updateProfile()
