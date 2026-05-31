import { IsOptional, IsEnum } from 'class-validator'
import { UserRole } from '@mediall/types'
import { PaginationDto } from '../../shared/dto/pagination.dto'

// Extends pagination so `page`/`limit`/`search` are accepted alongside `role`.
// Needed because the global ValidationPipe runs with `forbidNonWhitelisted`,
// which rejects any query param not declared on the bound DTO.
export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole
}
