import { IsString, IsEnum, IsOptional, IsInt, IsPositive } from 'class-validator'
import { MessageType } from '@mediall/types'

export class SendMessageDto {
  @IsString()
  content: string

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType

  @IsOptional()
  @IsString()
  replyToId?: string

  @IsOptional()
  @IsString()
  fileKey?: string

  @IsOptional()
  @IsString()
  fileName?: string

  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSize?: number

  @IsOptional()
  @IsString()
  fileMime?: string
}

export class EditMessageDto {
  @IsString()
  content: string
}
