import { IsEnum } from 'class-validator'
import { ParticipantStatus } from '@mediall/types'

export class RespondInviteDto {
  @IsEnum(ParticipantStatus)
  status: ParticipantStatus
}
