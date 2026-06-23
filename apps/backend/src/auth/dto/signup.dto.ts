import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

/**
 * Public tenant self-signup (plano 26.2). Creates a brand-new tenant with a
 * 14-day trial — no card required. The company becomes a `Tenant`, the person a
 * SUPER_ADMIN of a default unit.
 */
export class SignupDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da empresa.' })
  @MaxLength(80)
  companyName: string

  @IsString()
  @MinLength(2, { message: 'Informe seu nome.' })
  @MaxLength(80)
  name: string

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string

  // bcrypt only hashes the first 72 bytes; cap here so longer input isn't silently truncated.
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(72)
  password: string
}
