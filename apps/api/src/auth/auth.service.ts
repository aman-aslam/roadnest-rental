import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}
  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) throw new ConflictException('Provide an email address or mobile number');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const user = await this.prisma.user.create({ data: { name: dto.name.trim(), email: dto.email?.toLowerCase(), phone: dto.phone, passwordHash } });
      return this.issue(user);
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('That email or phone number is already registered');
      throw error;
    }
  }
  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const normalizedPhone = identifier.replace(/[\\s()-]/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: normalizedPhone },
        ],
      },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.issue(user);
  }
  private async issue(user: { id: string; name: string; email: string | null; phone: string | null; role: any }) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
  }
}
