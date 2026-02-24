import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface AdminRow {
  id: number;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: 'super' | 'regular';
  is_approved: boolean;
  is_blocked: boolean;
  failed_attempt_count: number;
  password_hash: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdminRepository extends BaseRepository {
  async findByTelegramId(telegramId: string): Promise<AdminRow | null> {
    return this.db('admins').where({ telegram_id: telegramId }).first() ?? null;
  }

  async findById(id: number): Promise<AdminRow | null> {
    return this.db('admins').where({ id }).first() ?? null;
  }

  async findAll(): Promise<AdminRow[]> {
    return this.db('admins').orderBy('created_at', 'asc');
  }

  async create(data: {
    telegram_id: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    role: 'super' | 'regular';
    is_approved?: boolean;
    password_hash?: string | null;
  }): Promise<AdminRow> {
    const [row] = await this.db('admins').insert(data).returning('*');
    return row;
  }

  async update(id: number, data: Partial<AdminRow>): Promise<void> {
    await this.db('admins').where({ id }).update({ ...data, updated_at: this.db.fn.now() });
  }

  async incrementFailedAttempts(id: number): Promise<void> {
    await this.db('admins').where({ id }).increment('failed_attempt_count', 1).update({ updated_at: this.db.fn.now() });
  }

  async resetFailedAttempts(id: number): Promise<void> {
    await this.db('admins').where({ id }).update({ failed_attempt_count: 0, updated_at: this.db.fn.now() });
  }

  async delete(id: number): Promise<void> {
    await this.db('admins').where({ id }).delete();
  }

  async countApproved(): Promise<number> {
    const [{ count }] = await this.db('admins').where({ is_approved: true, is_blocked: false }).count('id as count');
    return Number(count);
  }

  async findAllApprovedSuperAdmins(): Promise<AdminRow[]> {
    return this.db('admins').where({ role: 'super', is_approved: true, is_blocked: false });
  }
}
