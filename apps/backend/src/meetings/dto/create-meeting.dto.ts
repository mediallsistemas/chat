import {
  IsString,
  IsOptional,
  IsUUID,
  IsISO8601,
  IsBoolean,
  IsArray,
  MinLength,
} from 'class-validator'

export class CreateMeetingDto {
  @IsString()
  @MinLength(3)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsUUID()
  groupId?: string

  @IsISO8601()
  startAt: string

  @IsISO8601()
  endAt: string

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean

  @IsOptional()
  @IsString()
  recurrenceRule?: string

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds?: string[]
}
