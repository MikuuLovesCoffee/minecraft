import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length, Matches } from 'class-validator';
import { Request, Response } from 'express';
import { config } from '../config';
import { COOKIE } from './auth.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @Matches(/^[A-Za-z0-9_]{1,16}$/)
  name: string;

  @IsString()
  @Length(1, 128)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 5 attempts per minute per IP to stop password guessing.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = this.auth.verify(dto.name, dto.password);
    res.cookie(COOKIE, this.auth.sign(user), {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    return { user: this.auth.read(req.cookies?.[COOKIE]) };
  }
}
