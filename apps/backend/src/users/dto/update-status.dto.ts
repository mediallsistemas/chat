import { IsString, IsOptional, IsISO8601, MaxLength } from 'class-validator'

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customStatus?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(8)
  customStatusEmoji?: string | null

  @IsOptional()
  @IsISO8601()
  statusExpiresAt?: string | null
}
