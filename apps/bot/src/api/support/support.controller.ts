import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { SupportRepository } from '@/repositories/support.repository';
import { UserRepository } from '@/repositories/user.repository';
import { BotService } from '@/bot/bot.service';
import type { SupportThreadRow, SupportMessageRow } from '@/repositories/support.repository';
import type { SupportThreadDto, SupportMessageDto } from '@arab-tili/shared-types';
import { ReplyMessageDto } from './dto/reply-message.dto';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportRepo: SupportRepository,
    private readonly userRepo: UserRepository,
    private readonly botService: BotService,
  ) {}

  @Get('threads')
  async findThreads(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<{ data: SupportThreadDto[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const { rows, total } = await this.supportRepo.findThreads(status, pageNum, limitNum);

    const data = await Promise.all(rows.map(async (row) => {
      const user = await this.userRepo.findByTelegramId(String(row.user_id));
      return this.toThreadDto(row, user?.first_name ?? null, user?.last_name ?? null);
    }));

    return { data, total, page: pageNum, limit: limitNum };
  }

  @Get('threads/:id/messages')
  async getMessages(@Param('id') id: string): Promise<SupportMessageDto[]> {
    const messages = await this.supportRepo.getMessages(BigInt(id), 100);
    return messages.map(this.toMessageDto);
  }

  @Post('threads/:id/messages')
  async replyToThread(
    @Param('id') id: string,
    @Body() dto: ReplyMessageDto,
    @Request() req: { user: { sub: number } },
  ): Promise<SupportMessageDto> {
    if (!dto.text && !dto.mediaFileId) {
      throw new BadRequestException('text or mediaFileId required');
    }

    const thread = await this.supportRepo.findThreadById(BigInt(id));
    if (!thread) throw new NotFoundException('Thread not found');

    const msg = await this.supportRepo.addMessage({
      thread_id: thread.id,
      sender_type: 'admin',
      sender_id: BigInt(req.user.sub),
      body_text: dto.text ?? null,
      media_type: dto.mediaType ?? null,
      media_file_id: dto.mediaFileId ?? null,
    });

    // Deliver to user via Telegram
    const user = await this.userRepo.findByTelegramId(String(thread.user_id));
    if (user && !user.is_blocked) {
      try {
        await this.botService.bot.api.sendMessage(
          user.telegram_id,
          `💬 Admin: ${dto.text ?? ''}`,
        );
      } catch {
        // delivery failure is non-fatal
      }
    }

    return this.toMessageDto(msg);
  }

  @Patch('threads/:id/claim')
  async claimThread(
    @Param('id') id: string,
    @Request() req: { user: { sub: number } },
  ): Promise<{ success: boolean }> {
    await this.supportRepo.claimThread(BigInt(id), req.user.sub);
    return { success: true };
  }

  @Patch('threads/:id/close')
  async closeThread(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.supportRepo.closeThread(BigInt(id));
    return { success: true };
  }

  private toThreadDto(row: SupportThreadRow, firstName: string | null, lastName: string | null): SupportThreadDto {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      userFirstName: firstName,
      userLastName: lastName,
      status: row.status,
      claimedBy: row.claimed_by,
      createdAt: row.created_at?.toISOString() ?? '',
      updatedAt: row.updated_at?.toISOString() ?? '',
    };
  }

  private toMessageDto(row: SupportMessageRow): SupportMessageDto {
    return {
      id: String(row.id),
      threadId: String(row.thread_id),
      senderType: row.sender_type,
      senderId: String(row.sender_id),
      bodyText: row.body_text,
      mediaType: row.media_type,
      mediaFileId: row.media_file_id,
      sentAt: row.sent_at?.toISOString() ?? '',
    };
  }
}
