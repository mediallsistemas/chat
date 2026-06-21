import { IsEnum } from 'class-validator'
import { PlanTier } from '@mediall/types'

export class ChangeTierDto {
  @IsEnum(PlanTier)
  tier!: PlanTier
}
