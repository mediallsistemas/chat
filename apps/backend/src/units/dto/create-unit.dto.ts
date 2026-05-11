import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator'
import { UnitType } from '@prisma/client'

export class CreateUnitDto {
  @IsString()
  name: string

  @IsEnum(UnitType)
  type: UnitType

  @IsOptional()
  @IsUUID()
  parentId?: string

  @IsUUID()
  managerId: string
}
