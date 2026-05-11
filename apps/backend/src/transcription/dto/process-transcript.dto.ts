import { IsString, MinLength } from 'class-validator'

export class ProcessTranscriptDto {
  @IsString()
  @MinLength(10, { message: 'Transcrição deve ter ao menos 10 caracteres.' })
  transcript: string
}
