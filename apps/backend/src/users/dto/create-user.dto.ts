import { IsEmail, IsEnum, IsString, MinLength, IsOptional, IsUrl } from 'class-validator'
import { AccessScope } from '@mediall/types'

export class CreateUserDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsEnum(AccessScope)
  accessScope: AccessScope

  @IsOptional()
  @IsUrl()
  avatarUrl?: string
}
