import { IsUUID, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator'
import { UserRole } from '@mediall/types'

export class AssignUserDto {
  @IsUUID()
  userId: string

  @IsEnum(UserRole)
  role: UserRole

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
