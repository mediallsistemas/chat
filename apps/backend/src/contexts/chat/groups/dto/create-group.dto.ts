import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator'
import { GroupType, GroupVisibility } from '@mediall/types'

export class CreateGroupDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(GroupType)
  type: GroupType

  @IsOptional()
  @IsEnum(GroupVisibility)
  visibility?: GroupVisibility

  @IsOptional()
  @IsString()
  parentId?: string

  @IsOptional()
  @IsString()
  objectiveId?: string

  @IsOptional()
  @IsBoolean()
  onlyAdminsPost?: boolean

  @IsOptional()
  @IsDateString()
  archiveAt?: string
}

export class AddMemberDto {
  @IsString()
  userId: string

  @IsOptional()
  @IsString()
  role?: 'ADMIN' | 'MEMBER' | 'VIEWER'
}
