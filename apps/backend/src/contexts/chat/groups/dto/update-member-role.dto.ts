import { IsEnum } from 'class-validator'
import { GroupMemberRole } from '@mediall/types'

export class UpdateMemberRoleDto {
  @IsEnum(GroupMemberRole)
  role: GroupMemberRole
}
