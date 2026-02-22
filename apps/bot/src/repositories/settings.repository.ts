import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

@Injectable()
export class SettingsRepository extends BaseRepository {
  async get(key: string): Promise<string | null> {
    const row = await this.db('settings').where({ key }).first();
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = await this.db('settings').where({ key }).first();
    if (existing) {
      await this.db('settings').where({ key }).update({ value });
    } else {
      await this.db('settings').insert({ key, value });
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db('settings').select('key', 'value');
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  }
}
