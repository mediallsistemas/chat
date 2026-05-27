import { IsString, IsUUID } from 'class-validator'

export class CreateBookmarkDto {
  @IsString()
  @IsUUID()
  messageId: string
}
