import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { AdminRepository } from '@/repositories/admin.repository';
import { OtpService } from './otp.service';
import { AdminJwtGuard } from './admin-jwt.guard';

class OtpBodyDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly adminRepo: AdminRepository,
  ) {}

  @Post('otp')
  async loginWithOtp(@Body() body: OtpBodyDto) {
    const entry = this.otpService.consume(body.code);
    if (!entry) {
      throw new UnauthorizedException("Kod noto'g'ri yoki muddati o'tgan");
    }
    const payload = {
      sub: entry.adminId,
      telegramId: entry.telegramId,
      role: entry.role,
    };
    const accessToken = this.jwtService.sign(payload);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    return { accessToken, role: entry.role, expiresAt };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  async getMe(@Request() req: { user: { sub: number } }) {
    const admin = await this.adminRepo.findById(req.user.sub);
    if (!admin) throw new UnauthorizedException();
    return {
      id: admin.id,
      telegramId: admin.telegram_id,
      firstName: admin.first_name,
      lastName: admin.last_name,
      username: admin.username,
      role: admin.role,
      isApproved: admin.is_approved,
      isBlocked: admin.is_blocked,
      failedAttemptCount: admin.failed_attempt_count,
      createdAt: admin.created_at?.toISOString(),
    };
  }
}
