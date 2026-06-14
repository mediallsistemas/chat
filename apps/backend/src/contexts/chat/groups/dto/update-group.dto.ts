import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator'
import { GroupVisibility } from '@mediall/types'

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  /** MinIO key returned by POST /upload; the service stores it and resolves a signed URL on read. */
  @IsOptional()
  @IsString()
  avatarKey?: string

  @IsOptional()
  @IsBoolean()
  onlyAdminsPost?: boolean

  @IsOptional()
  @IsEnum(GroupVisibility)
  visibility?: GroupVisibility
}
