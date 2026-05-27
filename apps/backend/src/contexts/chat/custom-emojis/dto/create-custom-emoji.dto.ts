import { IsString, Matches, Length } from 'class-validator'

export class CreateCustomEmojiDto {
  @IsString()
  @Length(2, 32)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Shortcode deve conter apenas letras minúsculas, números, hífen e underline.',
  })
  shortcode: string
}
