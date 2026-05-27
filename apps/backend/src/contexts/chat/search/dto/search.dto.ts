import { IsString, IsOptional, IsISO8601, MinLength, MaxLength, IsUUID } from 'class-validator'

export class SearchMessagesDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  q: string

  @IsOptional()
  @IsUUID()
  groupId?: string

  @IsOptional()
  @IsISO8601()
  from?: string

  @IsOptional()
  @IsISO8601()
  to?: string

  @IsOptional()
  @IsString()
  cursor?: string
}
