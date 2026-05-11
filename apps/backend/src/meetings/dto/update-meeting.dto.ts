import { IsString, IsOptional, IsISO8601 } from 'class-validator'

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsISO8601()
  startAt?: string

  @IsOptional()
  @IsISO8601()
  endAt?: string

  @IsOptional()
  @IsString()
  recurrenceRule?: string
}
