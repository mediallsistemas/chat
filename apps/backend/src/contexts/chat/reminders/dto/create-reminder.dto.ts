import { IsString, IsOptional, IsISO8601, MaxLength } from 'class-validator'

export class CreateReminderDto {
  @IsString()
  @MaxLength(500)
  text: string

  @IsISO8601()
  remindAt: string

  @IsOptional()
  @IsString()
  groupId?: string
}
