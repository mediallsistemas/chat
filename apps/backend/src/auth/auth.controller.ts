import { Controller, Post, Get, Patch, Body, Res, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, IsString, IsUrl } from 'class-validator'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { SignupDto } from './dto/signup.dto'
import { Public } from '../shared/decorators/public.decorator'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'
import { generateCsrfToken } from '../csrf'
import { UsersService } from '../users/users.service'

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsUrl() avatarUrl?: string
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { csrfToken: generateCsrfToken(req, res) }
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res)
  }

  // Public tenant self-signup (plano 26.2). Rate-limited to curb abuse of an
  // endpoint that creates a whole tenant. @Public bypasses Jwt/Tenant/Billing guards.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.signup(dto, res)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res)
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user)
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto)
  }
}
