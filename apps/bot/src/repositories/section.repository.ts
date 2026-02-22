import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface SectionRow {
  id: number;
  parent_id: number | null;
  title: string;
  description: string | null;
  sort_order: number;
  is_locked_by_default: boolean;
  unlock_required_section: number | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SectionRepository extends BaseRepository {
  async findAll(includeDeleted = false): Promise<SectionRow[]> {
    let q = this.db('sections');
    if (!includeDeleted) q = q.where({ is_deleted: false });
    return q.orderBy(['parent_id', 'sort_order']);
  }

  async findById(id: number): Promise<SectionRow | null> {
    return this.db('sections').where({ id }).first() ?? null;
  }

  async findRoots(): Promise<SectionRow[]> {
    return this.db('sections')
      .whereNull('parent_id')
      .where({ is_deleted: false })
      .orderBy('sort_order');
  }

  async findChildren(parentId: number): Promise<SectionRow[]> {
    return this.db('sections')
      .where({ parent_id: parentId, is_deleted: false })
      .orderBy('sort_order');
  }

  async create(data: Omit<SectionRow, 'id' | 'created_at' | 'updated_at'>): Promise<SectionRow> {
    const [row] = await this.db('sections').insert(data).returning('*');
    return row;
  }

  async update(id: number, data: Partial<SectionRow>): Promise<void> {
    await this.db('sections').where({ id }).update({ ...data, updated_at: this.db.fn.now() });
  }

  async softDelete(id: number): Promise<void> {
    await this.db('sections').where({ id }).update({ is_deleted: true, updated_at: this.db.fn.now() });
  }

  async isUnlockedByUser(userId: bigint, sectionId: number): Promise<boolean> {
    const row = await this.db('section_unlocks').where({ user_id: userId, section_id: sectionId }).first();
    return !!row;
  }

  async unlockForUser(userId: bigint, sectionId: number): Promise<void> {
    await this.db('section_unlocks')
      .insert({ user_id: userId, section_id: sectionId })
      .onConflict(['user_id', 'section_id'])
      .ignore();
  }

  async getUserUnlockedIds(userId: bigint): Promise<number[]> {
    const rows = await this.db('section_unlocks').where({ user_id: userId }).select('section_id');
    return rows.map((r: { section_id: number }) => r.section_id);
  }
}
