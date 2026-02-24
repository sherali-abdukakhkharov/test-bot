import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRepository } from '@/repositories/admin.repository';
import type { JwtPayload } from '@arab-tili/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly adminRepo: AdminRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const admin = await this.adminRepo.findById(payload.sub);
    if (!admin || admin.is_blocked || !admin.is_approved) {
      throw new UnauthorizedException();
    }
    return {
      sub: payload.sub,
      telegramId: payload.telegramId,
      role: payload.role,
      adminRow: admin,
    };
  }
}
