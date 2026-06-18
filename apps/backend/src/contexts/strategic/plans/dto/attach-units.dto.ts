import { IsArray, ArrayNotEmpty, IsString } from 'class-validator'

export class AttachUnitsDto {
  // Unit ids são strings (não necessariamente UUID — ex.: "unit-uei" no seed).
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  unitIds: string[]
}
