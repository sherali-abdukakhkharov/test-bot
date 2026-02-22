import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface GuideItemRow {
  id: number;
  content_type: 'text' | 'video';
  body_text: string | null;
  media_file_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class GuideRepository extends BaseRepository {
  async findActive(): Promise<GuideItemRow[]> {
    return this.db('guide_items').where({ is_active: true }).orderBy('sort_order');
  }

  async findAll(): Promise<GuideItemRow[]> {
    return this.db('guide_items').orderBy('sort_order');
  }

  async findById(id: number): Promise<GuideItemRow | null> {
    return this.db('guide_items').where({ id }).first() ?? null;
  }

  async create(data: Omit<GuideItemRow, 'id' | 'created_at' | 'updated_at'>): Promise<GuideItemRow> {
    const [row] = await this.db('guide_items').insert(data).returning('*');
    return row;
  }

  async update(id: number, data: Partial<GuideItemRow>): Promise<void> {
    await this.db('guide_items').where({ id }).update({ ...data, updated_at: this.db.fn.now() });
  }

  async delete(id: number): Promise<void> {
    await this.db('guide_items').where({ id }).delete();
  }

  async reorder(items: Array<{ id: number; sort_order: number }>): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const item of items) {
        await trx('guide_items').where({ id: item.id }).update({ sort_order: item.sort_order });
      }
    });
  }

  async count(): Promise<number> {
    const [{ count }] = await this.db('guide_items').count('id as count');
    return Number(count);
  }
}
