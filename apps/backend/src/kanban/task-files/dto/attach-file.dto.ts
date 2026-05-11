import { IsString, IsNumber, IsPositive } from 'class-validator'

export class AttachFileDto {
  @IsString()
  fileKey: string

  @IsString()
  fileName: string

  @IsNumber()
  @IsPositive()
  fileSize: number

  @IsString()
  fileMime: string
}
