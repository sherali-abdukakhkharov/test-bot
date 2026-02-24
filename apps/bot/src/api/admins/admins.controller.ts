import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { SuperAdminGuard } from '@/api/auth/super-admin.guard';
import { AdminRepository } from '@/repositories/admin.repository';
import type { AdminRow } from '@/repositories/admin.repository';
import type { AdminDto } from '@arab-tili/shared-types';
import { BotService } from '@/bot/bot.service';
import { adminMenuKeyboard } from '@/common/utils/keyboard';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, SuperAdminGuard)
@Controller('admins')
export class AdminsController {
  constructor(
    private readonly adminRepo: AdminRepository,
    private readonly botService: BotService,
  ) {}

  @Get()
  async findAll(): Promise<AdminDto[]> {
    const rows = await this.adminRepo.findAll();
    return rows.map(this.toDto);
  }

  @Patch(':id/approve')
  async approve(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const admin = await this.adminRepo.findById(id);
    if (!admin) throw new NotFoundException('Admin topilmadi');
    await this.adminRepo.update(id, { is_approved: true });
    // Notify the newly approved admin in Telegram
    await this.botService.bot.api
      .sendMessage(
        admin.telegram_id,
        '✅ Sizning admin so\'rovingiz tasdiqlandi!\n\nEndi admin paneliga kirishingiz mumkin.',
        { reply_markup: adminMenuKeyboard() },
      )
      .catch(() => undefined); // ignore if user has blocked the bot
    return { success: true };
  }

  @Delete(':id/reject')
  async reject(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.adminRepo.delete(id);
    return { success: true };
  }

  @Patch(':id/block')
  async toggleBlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isBlocked: boolean },
  ): Promise<{ success: boolean }> {
    await this.adminRepo.update(id, {
      is_blocked: body.isBlocked,
      failed_attempt_count: 0,
    });
    return { success: true };
  }

  @Patch(':id/promote')
  async promote(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { sub: number } },
  ): Promise<{ success: boolean }> {
    if (id === req.user.sub) throw new ForbiddenException('O\'zingizni promote qila olmaysiz');
    const target = await this.adminRepo.findById(id);
    if (!target) throw new NotFoundException('Admin topilmadi');
    if (target.role === 'super') throw new BadRequestException('Allaqachon Super Admin');
    await this.adminRepo.update(id, { role: 'super' });
    return { success: true };
  }

  @Patch(':id/demote')
  async demote(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { sub: number } },
  ): Promise<{ success: boolean }> {
    if (id === req.user.sub) throw new ForbiddenException('O\'zingizni demote qila olmaysiz');
    const target = await this.adminRepo.findById(id);
    if (!target) throw new NotFoundException('Admin topilmadi');
    if (target.role !== 'super') throw new BadRequestException('Bu admin allaqachon oddiy admin');
    const superAdmins = await this.adminRepo.findAllApprovedSuperAdmins();
    if (superAdmins.length <= 1) throw new ForbiddenException('Oxirgi super adminni demote qilib bo\'lmaydi');
    await this.adminRepo.update(id, { role: 'regular' });
    return { success: true };
  }

  private toDto(row: AdminRow): AdminDto {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      role: row.role,
      isApproved: row.is_approved,
      isBlocked: row.is_blocked,
      failedAttemptCount: row.failed_attempt_count,
      createdAt: row.created_at?.toISOString() ?? '',
    };
  }
}
