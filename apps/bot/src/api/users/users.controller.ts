import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { UserRepository } from '@/repositories/user.repository';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import type { UserRow } from '@/repositories/user.repository';
import type { UserDto, TestSessionDto } from '@arab-tili/shared-types';

class BlockUserDto {
  @IsBoolean()
  isBlocked: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: TestSessionRepository,
  ) {}

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('isBlocked') isBlocked?: string,
  ): Promise<{ data: UserDto[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const blockedFilter = isBlocked === 'true' ? true : isBlocked === 'false' ? false : undefined;

    const { rows, total } = await this.userRepo.findAll({
      page: pageNum,
      limit: limitNum,
      search,
      isBlocked: blockedFilter,
    });
    return {
      data: rows.map(this.toDto),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get(':id/results')
  async getUserResults(@Param('id') id: string): Promise<TestSessionDto[]> {
    const user = await this.userRepo.findByTelegramId(id);
    if (!user) return [];
    const sessions = await this.sessionRepo.getUserHistory(user.id, 20);
    return sessions.map((s) => ({
      id: String(s.id),
      userId: String(s.user_id),
      topicId: s.topic_id,
      status: s.status,
      totalQuestions: s.total_questions,
      correctCount: s.correct_count,
      scorePercent: s.score_percent,
      startedAt: s.started_at?.toISOString() ?? '',
      finishedAt: s.finished_at?.toISOString() ?? null,
    }));
  }

  @Patch(':telegramId/block')
  async setBlocked(
    @Param('telegramId') telegramId: string,
    @Body() dto: BlockUserDto,
  ): Promise<{ success: boolean }> {
    await this.userRepo.setBlocked(telegramId, dto.isBlocked);
    return { success: true };
  }

  private toDto(row: UserRow): UserDto {
    return {
      id: String(row.id),
      telegramId: row.telegram_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      languageCode: row.language_code,
      nameScript: row.name_script,
      registrationState: row.registration_state,
      isBlocked: row.is_blocked,
      createdAt: row.created_at?.toISOString() ?? '',
    };
  }
}
