import { IsUUID, IsInt, Min } from 'class-validator'

export class MoveTaskDto {
  @IsUUID()
  columnId: string

  @IsInt()
  @Min(0)
  position: number
}
