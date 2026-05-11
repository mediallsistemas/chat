import { IsString, IsUUID, IsDateString, IsEnum, IsOptional } from 'class-validator'
import { ImpedimentStatus } from '@mediall/types'

export class CreateImpedimentDto {
  @IsString()
  description: string

  @IsUUID()
  responsibleForResolution: string

  @IsDateString()
  expectedResolutionDate: string

  @IsEnum(ImpedimentStatus)
  @IsOptional()
  status?: ImpedimentStatus = ImpedimentStatus.BLOCKED
}

export class ResolveImpedimentDto {
  @IsString()
  resolutionNotes: string
}
