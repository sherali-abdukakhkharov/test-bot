import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { AnnouncementRepository } from '@/repositories/announcement.repository';
import { UserRepository } from '@/repositories/user.repository';
import { BotService } from '@/bot/bot.service';
import type { AnnouncementRow } from '@/repositories/announcement.repository';
import type { AnnouncementDto } from '@arab-tili/shared-types';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(
    private readonly announcementRepo: AnnouncementRepository,
    private readonly userRepo: UserRepository,
    private readonly botService: BotService,
  ) {}

  @Get()
  async findAll(): Promise<AnnouncementDto[]> {
    const rows = await this.announcementRepo.findAll(true);
    const now = new Date();
    return rows.map((r) => this.toDto(r, now));
  }

  @Post()
  async create(
    @Body() dto: CreateAnnouncementDto,
    @Request() req: { user: { sub: number } },
  ): Promise<AnnouncementDto> {
    if (!dto.bodyText && !dto.mediaFileId) {
      throw new BadRequestException('bodyText or mediaFileId required');
    }
    const row = await this.announcementRepo.create({
      created_by: req.user.sub,
      body_text: dto.bodyText ?? null,
      media_type: dto.mediaType ?? null,
      media_file_id: dto.mediaFileId ?? null,
      expires_at: null,
    });

    // Broadcast asynchronously — don't await
    this.broadcastAsync(row).catch(() => {});

    return this.toDto(row, new Date());
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string): Promise<{ announcementId: string; status: string }> {
    // The current schema has no delivery tracking table.
    // Return a placeholder — can be extended later.
    return { announcementId: id, status: 'sent' };
  }

  private async broadcastAsync(announcement: AnnouncementRow): Promise<void> {
    const DELAY_MS = 35;
    const { rows: users } = await this.userRepo.findAll({ page: 1, limit: 100000 });
    for (const user of users) {
      if (user.is_blocked) continue;
      try {
        if (announcement.media_type && announcement.media_file_id) {
          await this.sendMedia(user.telegram_id, announcement);
        } else if (announcement.body_text) {
          await this.botService.bot.api.sendMessage(user.telegram_id, announcement.body_text);
        }
      } catch {
        // silently skip failed deliveries
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  private async sendMedia(telegramId: string, ann: AnnouncementRow): Promise<void> {
    const caption = ann.body_text ?? undefined;
    const fileId = ann.media_file_id!;
    switch (ann.media_type) {
      case 'photo':
        await this.botService.bot.api.sendPhoto(telegramId, fileId, { caption });
        break;
      case 'video':
        await this.botService.bot.api.sendVideo(telegramId, fileId, { caption });
        break;
      case 'document':
        await this.botService.bot.api.sendDocument(telegramId, fileId, { caption });
        break;
      default:
        if (ann.body_text) await this.botService.bot.api.sendMessage(telegramId, ann.body_text);
    }
  }

  private toDto(row: AnnouncementRow, now: Date): AnnouncementDto {
    return {
      id: String(row.id),
      createdBy: row.created_by,
      bodyText: row.body_text,
      mediaType: row.media_type,
      mediaFileId: row.media_file_id,
      expiresAt: row.expires_at?.toISOString() ?? null,
      createdAt: row.created_at?.toISOString() ?? '',
      isExpired: row.expires_at ? row.expires_at < now : false,
    };
  }
}
