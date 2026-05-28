import { IsString, MinLength, MaxLength } from 'class-validator'

export class SendMeetingChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string
}
