import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { GuideRepository } from '@/repositories/guide.repository';
import type { GuideItemRow } from '@/repositories/guide.repository';
import type { GuideItemDto, ReorderItem } from '@arab-tili/shared-types';
import { CreateGuideItemDto, UpdateGuideItemDto } from './dto/guide-item.dto';

const MAX_GUIDE_ITEMS = 20;

@ApiTags('guide')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('guide')
export class GuideController {
  constructor(private readonly guideRepo: GuideRepository) {}

  @Get()
  async findAll(): Promise<GuideItemDto[]> {
    const rows = await this.guideRepo.findAll();
    return rows.map(this.toDto);
  }

  @Post()
  async create(@Body() dto: CreateGuideItemDto): Promise<GuideItemDto> {
    const count = await this.guideRepo.count();
    if (count >= MAX_GUIDE_ITEMS) {
      throw new BadRequestException(`Maksimal ${MAX_GUIDE_ITEMS} ta element qo'shish mumkin`);
    }
    const row = await this.guideRepo.create({
      content_type: dto.contentType,
      body_text: dto.bodyText ?? null,
      media_file_id: dto.mediaFileId ?? null,
      sort_order: dto.sortOrder ?? count,
      is_active: dto.isActive ?? true,
    });
    return this.toDto(row);
  }

  @Patch('reorder')
  async reorder(@Body() items: ReorderItem[]): Promise<{ success: boolean }> {
    await this.guideRepo.reorder(items.map((i) => ({ id: i.id, sort_order: i.sortOrder })));
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGuideItemDto,
  ): Promise<{ success: boolean }> {
    const data: Partial<GuideItemRow> = {};
    if (dto.bodyText !== undefined) data.body_text = dto.bodyText;
    if (dto.mediaFileId !== undefined) data.media_file_id = dto.mediaFileId;
    if (dto.isActive !== undefined) data.is_active = dto.isActive;
    if (dto.sortOrder !== undefined) data.sort_order = dto.sortOrder;
    await this.guideRepo.update(id, data);
    return { success: true };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.guideRepo.delete(id);
    return { success: true };
  }

  private toDto(row: GuideItemRow): GuideItemDto {
    return {
      id: row.id,
      contentType: row.content_type,
      bodyText: row.body_text,
      mediaFileId: row.media_file_id,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at?.toISOString() ?? '',
    };
  }
}
