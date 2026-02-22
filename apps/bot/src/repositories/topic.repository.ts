import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface TopicRow {
  id: number;
  section_id: number;
  title: string;
  sort_order: number;
  time_per_question_sec: number;
  options_count: number;
  daily_attempt_limit: number;
  is_locked_by_default: boolean;
  unlock_required_topic: number | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TopicRepository extends BaseRepository {
  async findBySection(sectionId: number): Promise<TopicRow[]> {
    return this.db('topics').where({ section_id: sectionId, is_deleted: false }).orderBy('sort_order');
  }

  async findById(id: number): Promise<TopicRow | null> {
    return this.db('topics').where({ id }).first() ?? null;
  }

  async findAll(includeDeleted = false): Promise<TopicRow[]> {
    let q = this.db('topics');
    if (!includeDeleted) q = q.where({ is_deleted: false });
    return q.orderBy(['section_id', 'sort_order']);
  }

  async create(data: Omit<TopicRow, 'id' | 'created_at' | 'updated_at'>): Promise<TopicRow> {
    const [row] = await this.db('topics').insert(data).returning('*');
    return row;
  }

  async update(id: number, data: Partial<TopicRow>): Promise<void> {
    await this.db('topics').where({ id }).update({ ...data, updated_at: this.db.fn.now() });
  }

  async softDelete(id: number): Promise<void> {
    await this.db('topics').where({ id }).update({ is_deleted: true, updated_at: this.db.fn.now() });
  }

  async countQuestions(topicId: number): Promise<number> {
    const [{ count }] = await this.db('questions')
      .where({ topic_id: topicId, is_deleted: false })
      .count('id as count');
    return Number(count);
  }

  async isUnlockedByUser(userId: bigint, topicId: number): Promise<boolean> {
    const row = await this.db('topic_unlocks').where({ user_id: userId, topic_id: topicId }).first();
    return !!row;
  }

  async unlockForUser(userId: bigint, topicId: number): Promise<void> {
    await this.db('topic_unlocks')
      .insert({ user_id: userId, topic_id: topicId })
      .onConflict(['user_id', 'topic_id'])
      .ignore();
  }

  async getUserUnlockedIds(userId: bigint): Promise<number[]> {
    const rows = await this.db('topic_unlocks').where({ user_id: userId }).select('topic_id');
    return rows.map((r: { topic_id: number }) => r.topic_id);
  }
}
