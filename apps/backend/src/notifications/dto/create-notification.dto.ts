import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { NotificationType } from '@mediall/types'

export class CreateNotificationDto {
  @IsUUID()
  userId: string

  @IsString()
  title: string

  @IsString()
  body: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsOptional()
  @IsString()
  entityType?: string

  @IsOptional()
  @IsUUID()
  entityId?: string

  @IsOptional()
  @IsUUID()
  unitId?: string
}
