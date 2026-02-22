import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface UserRow {
  id: bigint;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  language_code: string | null;
  name_script: string | null;
  registration_state: string;
  is_blocked: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UserRepository extends BaseRepository {
  async findByTelegramId(telegramId: string | number): Promise<UserRow | null> {
    return this.db('users').where({ telegram_id: String(telegramId) }).first() ?? null;
  }

  async upsert(data: {
    telegram_id: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    language_code?: string | null;
  }): Promise<UserRow> {
    const existing = await this.findByTelegramId(data.telegram_id);
    if (existing) {
      const [updated] = await this.db('users')
        .where({ telegram_id: data.telegram_id })
        .update({ ...data, updated_at: this.db.fn.now() })
        .returning('*');
      return updated;
    }
    const [inserted] = await this.db('users').insert(data).returning('*');
    return inserted;
  }

  async updateState(telegramId: string, state: string): Promise<void> {
    await this.db('users')
      .where({ telegram_id: telegramId })
      .update({ registration_state: state, updated_at: this.db.fn.now() });
  }

  async completeRegistration(
    telegramId: string,
    firstName: string,
    lastName: string | null,
    nameScript: string,
  ): Promise<void> {
    await this.db('users').where({ telegram_id: telegramId }).update({
      first_name: firstName,
      last_name: lastName,
      name_script: nameScript,
      registration_state: 'confirmed',
      updated_at: this.db.fn.now(),
    });
  }

  async setBlocked(telegramId: string, blocked: boolean): Promise<void> {
    await this.db('users')
      .where({ telegram_id: telegramId })
      .update({ is_blocked: blocked, updated_at: this.db.fn.now() });
  }

  async findAll(opts: { page: number; limit: number; search?: string; isBlocked?: boolean }): Promise<{ rows: UserRow[]; total: number }> {
    let query = this.db('users');
    if (opts.search) {
      query = query.whereILike('first_name', `%${opts.search}%`);
    }
    if (opts.isBlocked !== undefined) {
      query = query.where({ is_blocked: opts.isBlocked });
    }
    const [{ count }] = await query.clone().count('id as count');
    const rows = await query
      .orderBy('created_at', 'desc')
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);
    return { rows, total: Number(count) };
  }

  async countToday(): Promise<number> {
    const [{ count }] = await this.db('users')
      .whereRaw("created_at::date = CURRENT_DATE")
      .count('id as count');
    return Number(count);
  }

  async countAll(): Promise<number> {
    const [{ count }] = await this.db('users').count('id as count');
    return Number(count);
  }
}
