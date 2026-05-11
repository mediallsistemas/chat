import { IsString, IsEnum, IsOptional, IsUUID, IsDateString, IsNumber, Min } from 'class-validator'
import { Priority } from '@mediall/types'

export class CreateTaskDto {
  @IsUUID()
  boardId: string

  @IsUUID()
  columnId: string

  @IsOptional()
  @IsUUID()
  macroTaskId?: string

  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsUUID()
  responsibleUserId: string

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority = Priority.MEDIUM

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number
}
