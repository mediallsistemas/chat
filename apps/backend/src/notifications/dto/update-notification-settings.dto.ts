import { IsBoolean, IsOptional, IsString, Matches, IsArray } from 'class-validator'

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  dndEnabled?: boolean

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dndStart must be HH:MM' })
  dndStart?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dndEnd must be HH:MM' })
  dndEnd?: string

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emailTypes?: string[]

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean
}
