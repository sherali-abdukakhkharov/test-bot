import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface AnnouncementRow {
  id: bigint;
  created_by: number | null;
  body_text: string | null;
  media_type: string | null;
  media_file_id: string | null;
  expires_at: Date;
  created_at: Date;
}

@Injectable()
export class AnnouncementRepository extends BaseRepository {
  async create(data: Omit<AnnouncementRow, 'id' | 'created_at'>): Promise<AnnouncementRow> {
    const [row] = await this.db('announcements').insert(data).returning('*');
    return row;
  }

  async findAll(includeExpired = false): Promise<AnnouncementRow[]> {
    let q = this.db('announcements');
    if (!includeExpired) {
      q = q.where((b) => b.whereNull('expires_at').orWhere('expires_at', '>', this.db.fn.now()));
    }
    return q.orderBy('created_at', 'desc');
  }

  async findById(id: bigint): Promise<AnnouncementRow | null> {
    return this.db('announcements').where({ id }).first() ?? null;
  }
}
