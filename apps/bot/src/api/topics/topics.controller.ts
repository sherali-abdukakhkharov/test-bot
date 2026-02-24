import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { TopicRepository } from '@/repositories/topic.repository';
import type { TopicRow } from '@/repositories/topic.repository';
import type { TopicDto, ReorderItem } from '@arab-tili/shared-types';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@ApiTags('topics')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicRepo: TopicRepository) {}

  @Get()
  async findAll(
    @Query('sectionId') sectionId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<TopicDto[]> {
    let rows: TopicRow[];
    if (sectionId) {
      rows = await this.topicRepo.findBySection(Number(sectionId));
    } else {
      rows = await this.topicRepo.findAll(includeDeleted === 'true');
    }

    return Promise.all(rows.map(async (row) => {
      const questionCount = await this.topicRepo.countQuestions(row.id);
      return this.toDto(row, questionCount);
    }));
  }

  @Post()
  async create(@Body() dto: CreateTopicDto): Promise<TopicDto> {
    const row = await this.topicRepo.create({
      section_id: dto.sectionId,
      title: dto.title,
      sort_order: dto.sortOrder ?? 0,
      time_per_question_sec: dto.timePerQuestionSec ?? 30,
      options_count: dto.optionsCount ?? 4,
      daily_attempt_limit: dto.dailyAttemptLimit ?? 3,
      is_locked_by_default: dto.isLockedByDefault ?? false,
      unlock_required_topic: dto.unlockRequiredTopic ?? null,
      is_deleted: false,
    });
    return this.toDto(row);
  }

  @Patch('reorder')
  async reorder(@Body() items: ReorderItem[]): Promise<{ success: boolean }> {
    for (const item of items) {
      await this.topicRepo.update(item.id, { sort_order: item.sortOrder });
    }
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTopicDto,
  ): Promise<{ success: boolean }> {
    const data: Partial<TopicRow> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sortOrder !== undefined) data.sort_order = dto.sortOrder;
    if (dto.timePerQuestionSec !== undefined) data.time_per_question_sec = dto.timePerQuestionSec;
    if (dto.optionsCount !== undefined) data.options_count = dto.optionsCount;
    if (dto.dailyAttemptLimit !== undefined) data.daily_attempt_limit = dto.dailyAttemptLimit;
    if (dto.isLockedByDefault !== undefined) data.is_locked_by_default = dto.isLockedByDefault;
    if (dto.unlockRequiredTopic !== undefined) data.unlock_required_topic = dto.unlockRequiredTopic;
    await this.topicRepo.update(id, data);
    return { success: true };
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.topicRepo.softDelete(id);
    return { success: true };
  }

  private toDto(row: TopicRow, questionCount = 0): TopicDto {
    return {
      id: row.id,
      sectionId: row.section_id,
      title: row.title,
      sortOrder: row.sort_order,
      timePerQuestionSec: row.time_per_question_sec,
      optionsCount: row.options_count,
      dailyAttemptLimit: row.daily_attempt_limit,
      isLockedByDefault: row.is_locked_by_default,
      unlockRequiredTopic: row.unlock_required_topic,
      isDeleted: row.is_deleted,
      questionCount,
      createdAt: row.created_at?.toISOString() ?? '',
    };
  }
}
