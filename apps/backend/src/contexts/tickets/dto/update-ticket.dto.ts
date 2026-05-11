import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator'
import { TicketStatus, TicketPriority } from '@mediall/types'

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @IsOptional()
  @IsUUID()
  assignedTo?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsString()
  category?: string
}
