import { IsString, IsInt, IsEnum, IsOptional, IsUUID, IsDateString, Min } from 'class-validator'
import { UnitScope } from '@mediall/types'

export class CreatePhaseDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsInt()
  @Min(1)
  order: number

  @IsEnum(UnitScope)
  @IsOptional()
  unitScope?: UnitScope = UnitScope.ALL

  @IsOptional()
  @IsUUID()
  unitId?: string

  @IsUUID()
  responsibleUserId: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string
}
