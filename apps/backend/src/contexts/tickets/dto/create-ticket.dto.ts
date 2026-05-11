import { IsString, IsOptional, IsEnum, IsUUID, IsDateString, MinLength } from 'class-validator'
import { TicketPriority } from '@mediall/types'

export class CreateTicketDto {
  @IsString()
  @MinLength(5)
  title: string

  @IsString()
  @MinLength(10)
  description: string

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsUUID()
  assignedTo?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string
}
