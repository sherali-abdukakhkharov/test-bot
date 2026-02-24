import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { SuperAdminGuard } from '@/api/auth/super-admin.guard';
import { SettingsRepository } from '@/repositories/settings.repository';
import type { SettingsDto } from '@arab-tili/shared-types';
import { UpdatePasswordDto } from './dto/update-password.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsRepo: SettingsRepository) {}

  @Get()
  async getSettings(): Promise<SettingsDto> {
    const [adminPass, superPass] = await Promise.all([
      this.settingsRepo.get('admin_shared_password'),
      this.settingsRepo.get('super_admin_password'),
    ]);
    return {
      adminSharedPasswordSet: !!adminPass,
      superAdminPasswordSet: !!superPass,
    };
  }

  @Patch('admin-password')
  @UseGuards(SuperAdminGuard)
  async updateAdminPassword(@Body() dto: UpdatePasswordDto): Promise<{ success: boolean }> {
    const hash = await bcrypt.hash(dto.password, 10);
    await this.settingsRepo.set('admin_shared_password', hash);
    return { success: true };
  }

  @Patch('super-password')
  @UseGuards(SuperAdminGuard)
  async updateSuperPassword(@Body() dto: UpdatePasswordDto): Promise<{ success: boolean }> {
    const hash = await bcrypt.hash(dto.password, 10);
    await this.settingsRepo.set('super_admin_password', hash);
    return { success: true };
  }
}
