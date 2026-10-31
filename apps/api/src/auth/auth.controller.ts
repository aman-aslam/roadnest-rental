import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private config: ConfigService) {}
  private cookieOptions() { return { httpOnly: true, secure: this.config.get('COOKIE_SECURE') === 'true', sameSite: 'lax' as const, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 }; }
  @Post('register') async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto); res.cookie('rn_token', result.token, this.cookieOptions()); return { user: result.user };
  }
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto); res.cookie('rn_token', result.token, this.cookieOptions()); return { user: result.user };
  }
  @Post('logout') logout(@Res({ passthrough: true }) res: Response) { res.clearCookie('rn_token', { httpOnly: true, sameSite: 'lax', path: '/' }); return { ok: true }; }
  @Get('me') @UseGuards(AuthGuard('jwt')) me(@Req() req: Request & { user: any }) { return { user: req.user }; }
}
