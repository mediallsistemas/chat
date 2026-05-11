import { IsString, IsEnum, IsOptional, IsNumber, IsUUID } from 'class-validator'
import { Direction, CalcMethod } from '@mediall/types'

export class CreateGoalDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsUUID()
  sectorId?: string

  @IsOptional()
  @IsNumber()
  investment?: number

  @IsEnum(Direction)
  direction: Direction

  @IsEnum(CalcMethod)
  calcMethod: CalcMethod

  @IsOptional()
  @IsNumber()
  targetValue?: number

  @IsOptional()
  @IsNumber()
  initialValue?: number
}
