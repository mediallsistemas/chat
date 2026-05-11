import { IsBoolean, IsEnum } from 'class-validator'
import { ConsentType } from '@prisma/client'

export class UpdateConsentDto {
  @IsEnum(ConsentType)
  type: ConsentType

  @IsBoolean()
  accepted: boolean
}
