import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator'

export class CreateObjectiveDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  benefits?: string

  @IsUUID()
  responsibleUserId: string

  @IsOptional()
  @IsUUID()
  responsibleSectorId?: string

  @IsDateString()
  deadline: string

  @IsOptional()
  @IsUUID()
  groupId?: string
}
