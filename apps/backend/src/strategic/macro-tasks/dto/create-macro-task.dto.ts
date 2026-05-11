import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator'

export class CreateMacroTaskDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsUUID()
  responsibleUserId: string

  @IsOptional()
  @IsUUID()
  sectorId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsUUID()
  groupId?: string
}
