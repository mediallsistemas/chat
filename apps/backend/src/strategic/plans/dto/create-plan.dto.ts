import { IsString, IsInt, IsEnum, IsOptional, Min, Max } from 'class-validator'
import { PlanStatus } from '@mediall/types'

export class CreatePlanDto {
  @IsString()
  name: string

  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number

  @IsEnum(PlanStatus)
  @IsOptional()
  status?: PlanStatus = PlanStatus.DRAFT

  @IsOptional()
  @IsString()
  vision?: string

  @IsOptional()
  @IsString()
  mission?: string

  @IsOptional()
  @IsString()
  values?: string
}
