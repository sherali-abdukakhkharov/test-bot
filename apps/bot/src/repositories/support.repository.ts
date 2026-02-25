import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface SupportThreadRow {
  id: bigint;
  user_id: bigint;
  status: 'open' | 'claimed' | 'closed';
  claimed_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupportThreadNotificationRow {
  id: number;
  thread_id: bigint;
  admin_telegram_id: bigint;
  message_id: bigint;
}

export interface SupportMessageRow {
  id: bigint;
  thread_id: bigint;
  sender_type: 'user' | 'admin';
  sender_id: bigint;
  body_text: string | null;
  media_type: string | null;
  media_file_id: string | null;
  sent_at: Date;
}

@Injectable()
export class SupportRepository extends BaseRepository {
  async createThread(userId: bigint): Promise<SupportThreadRow> {
    const [row] = await this.db('support_threads').insert({ user_id: userId }).returning('*');
    return row;
  }

  async findOpenThreadByUser(userId: bigint): Promise<SupportThreadRow | null> {
    return (
      this.db('support_threads')
        .where({ user_id: userId })
        .whereIn('status', ['open', 'claimed'])
        .first() ?? null
    );
  }

  async findThreadById(id: bigint): Promise<SupportThreadRow | null> {
    return this.db('support_threads').where({ id }).first() ?? null;
  }

  async findThreads(status?: string, page = 1, limit = 20): Promise<{ rows: SupportThreadRow[]; total: number }> {
    let q = this.db('support_threads');
    if (status) q = q.where({ status });
    const [{ count }] = await q.clone().count('id as count');
    const rows = await q.orderBy('updated_at', 'desc').limit(limit).offset((page - 1) * limit);
    return { rows, total: Number(count) };
  }

  async claimThread(threadId: bigint, adminId: number): Promise<void> {
    await this.db('support_threads')
      .where({ id: threadId, status: 'open' })
      .update({ status: 'claimed', claimed_by: adminId, updated_at: this.db.fn.now() });
  }

  async saveAdminNotification(threadId: bigint, adminTelegramId: number | string, messageId: number): Promise<void> {
    await this.db('support_thread_notifications').insert({
      thread_id: threadId,
      admin_telegram_id: adminTelegramId,
      message_id: messageId,
    });
  }

  async findAdminNotifications(threadId: bigint): Promise<SupportThreadNotificationRow[]> {
    return this.db('support_thread_notifications').where({ thread_id: threadId });
  }

  async deleteAdminNotifications(threadId: bigint): Promise<void> {
    await this.db('support_thread_notifications').where({ thread_id: threadId }).delete();
  }

  async closeThread(threadId: bigint): Promise<void> {
    await this.db('support_threads').where({ id: threadId }).update({ status: 'closed', updated_at: this.db.fn.now() });
  }

  async addMessage(data: Omit<SupportMessageRow, 'id' | 'sent_at'>): Promise<SupportMessageRow> {
    const [row] = await this.db('support_messages').insert(data).returning('*');
    await this.db('support_threads')
      .where({ id: data.thread_id })
      .update({ updated_at: this.db.fn.now() });
    return row;
  }

  async getMessages(threadId: bigint, limit = 50): Promise<SupportMessageRow[]> {
    return this.db('support_messages').where({ thread_id: threadId }).orderBy('sent_at', 'asc').limit(limit);
  }
}
