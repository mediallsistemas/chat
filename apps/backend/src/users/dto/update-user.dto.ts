import { IsOptional, IsString, IsUrl, IsBoolean } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsUrl()
  avatarUrl?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
