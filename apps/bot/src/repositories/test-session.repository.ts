import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Tashkent';

export interface TestSessionRow {
  id: bigint;
  user_id: bigint;
  topic_id: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  total_questions: number;
  correct_count: number;
  score_percent: string;
  attempt_date_tashkent: string;
  started_at: Date;
  finished_at: Date | null;
}

export interface TestAnswerRow {
  id: bigint;
  session_id: bigint;
  question_id: number;
  question_snapshot: string;
  chosen_option_id: number | null;
  chosen_option_text: string | null;
  correct_option_text: string;
  is_correct: boolean;
  answered_at: Date;
}

@Injectable()
export class TestSessionRepository extends BaseRepository {
  private todayTashkent(): string {
    return dayjs().tz(TZ).format('YYYY-MM-DD');
  }

  async create(userId: bigint, topicId: number, totalQuestions: number): Promise<TestSessionRow> {
    const [row] = await this.db('test_sessions')
      .insert({
        user_id: userId,
        topic_id: topicId,
        total_questions: totalQuestions,
        attempt_date_tashkent: this.todayTashkent(),
      })
      .returning('*');
    return row;
  }

  async findById(id: bigint): Promise<TestSessionRow | null> {
    return this.db('test_sessions').where({ id }).first() ?? null;
  }

  async findActiveByUser(userId: bigint): Promise<TestSessionRow | null> {
    return this.db('test_sessions').where({ user_id: userId, status: 'in_progress' }).first() ?? null;
  }

  async complete(id: bigint, correctCount: number, totalQuestions: number): Promise<void> {
    const scorePercent = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : '0.00';
    await this.db('test_sessions').where({ id }).update({
      status: 'completed',
      correct_count: correctCount,
      score_percent: scorePercent,
      finished_at: this.db.fn.now(),
    });
  }

  async abandon(id: bigint): Promise<void> {
    await this.db('test_sessions').where({ id }).update({ status: 'abandoned', finished_at: this.db.fn.now() });
  }

  async recordAnswer(data: Omit<TestAnswerRow, 'id' | 'answered_at'>): Promise<void> {
    await this.db('test_answers').insert(data);
  }

  async getAnswers(sessionId: bigint): Promise<TestAnswerRow[]> {
    return this.db('test_answers').where({ session_id: sessionId }).orderBy('id');
  }

  async countTodayAttempts(userId: bigint, topicId: number): Promise<number> {
    const today = this.todayTashkent();
    const row = await this.db('daily_attempt_counts')
      .where({ user_id: userId, topic_id: topicId, attempt_date: today })
      .first();
    return row?.count ?? 0;
  }

  async incrementDailyCount(userId: bigint, topicId: number): Promise<void> {
    const today = this.todayTashkent();
    await this.db('daily_attempt_counts')
      .insert({ user_id: userId, topic_id: topicId, attempt_date: today, count: 1 })
      .onConflict(['user_id', 'topic_id', 'attempt_date'])
      .merge({ count: this.db.raw('daily_attempt_counts.count + 1') });
  }

  async getUserHistory(userId: bigint, limit = 20): Promise<TestSessionRow[]> {
    return this.db('test_sessions')
      .where({ user_id: userId, status: 'completed' })
      .orderBy('finished_at', 'desc')
      .limit(limit);
  }

  async countTodaySessions(): Promise<number> {
    const today = this.todayTashkent();
    const [{ count }] = await this.db('test_sessions')
      .where({ attempt_date_tashkent: today })
      .count('id as count');
    return Number(count);
  }

  async countAllSessions(): Promise<number> {
    const [{ count }] = await this.db('test_sessions').count('id as count');
    return Number(count);
  }

  async getLeaderboard(limit = 40): Promise<Array<{ user_id: bigint; best_score: number; sessions: number }>> {
    return this.db('test_sessions')
      .where({ status: 'completed' })
      .groupBy('user_id')
      .select(
        'user_id',
        this.db.raw('MAX(score_percent::numeric) as best_score'),
        this.db.raw('COUNT(*) as sessions'),
      )
      .orderBy('best_score', 'desc')
      .limit(limit);
  }
}
