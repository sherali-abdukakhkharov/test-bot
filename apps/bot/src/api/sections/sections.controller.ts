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
import { SectionRepository } from '@/repositories/section.repository';
import type { SectionRow } from '@/repositories/section.repository';
import type { SectionDto, SectionTreeNode, ReorderItem } from '@arab-tili/shared-types';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@ApiTags('sections')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionRepo: SectionRepository) {}

  @Get()
  async findAll(
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<SectionDto[]> {
    const rows = await this.sectionRepo.findAll(includeDeleted === 'true');
    return rows.map(this.toDto);
  }

  @Get('tree')
  async getTree(): Promise<SectionTreeNode[]> {
    const rows = await this.sectionRepo.findAll(false);
    return this.buildTree(rows.map(this.toDto));
  }

  @Post()
  async create(@Body() dto: CreateSectionDto): Promise<SectionDto> {
    const row = await this.sectionRepo.create({
      parent_id: dto.parentId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      sort_order: dto.sortOrder ?? 0,
      is_locked_by_default: dto.isLockedByDefault ?? false,
      unlock_required_section: dto.unlockRequiredSection ?? null,
      is_deleted: false,
    });
    return this.toDto(row);
  }

  @Patch('reorder')
  async reorder(@Body() items: ReorderItem[]): Promise<{ success: boolean }> {
    for (const item of items) {
      await this.sectionRepo.update(item.id, { sort_order: item.sortOrder });
    }
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectionDto,
  ): Promise<{ success: boolean }> {
    const data: Partial<SectionRow> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.parentId !== undefined) data.parent_id = dto.parentId;
    if (dto.sortOrder !== undefined) data.sort_order = dto.sortOrder;
    if (dto.isLockedByDefault !== undefined) data.is_locked_by_default = dto.isLockedByDefault;
    if (dto.unlockRequiredSection !== undefined) data.unlock_required_section = dto.unlockRequiredSection;
    await this.sectionRepo.update(id, data);
    return { success: true };
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.sectionRepo.softDelete(id);
    return { success: true };
  }

  private toDto(row: SectionRow): SectionDto {
    return {
      id: row.id,
      parentId: row.parent_id,
      title: row.title,
      description: row.description,
      sortOrder: row.sort_order,
      isLockedByDefault: row.is_locked_by_default,
      unlockRequiredSection: row.unlock_required_section,
      isDeleted: row.is_deleted,
      createdAt: row.created_at?.toISOString() ?? '',
    };
  }

  private buildTree(nodes: SectionDto[]): SectionTreeNode[] {
    const map = new Map<number, SectionTreeNode>(
      nodes.map((n) => [n.id, { ...n, children: [] }]),
    );
    const roots: SectionTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId === null) {
        roots.push(node);
      } else {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
      }
    }
    return roots;
  }
}
