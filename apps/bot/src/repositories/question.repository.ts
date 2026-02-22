import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export interface QuestionRow {
  id: number;
  topic_id: number;
  body_text: string | null;
  media_type: string | null;
  media_file_id: string | null;
  sort_order: number;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AnswerOptionRow {
  id: number;
  question_id: number;
  body_text: string;
  is_correct: boolean;
  sort_order: number;
  is_deleted: boolean;
}

export interface QuestionWithOptions extends QuestionRow {
  options: AnswerOptionRow[];
}

@Injectable()
export class QuestionRepository extends BaseRepository {
  async findByTopic(topicId: number): Promise<QuestionRow[]> {
    return this.db('questions').where({ topic_id: topicId, is_deleted: false }).orderBy('sort_order');
  }

  async findById(id: number): Promise<QuestionRow | null> {
    return this.db('questions').where({ id }).first() ?? null;
  }

  async findWithOptions(id: number): Promise<QuestionWithOptions | null> {
    const q = await this.findById(id);
    if (!q) return null;
    const options = await this.db('answer_options')
      .where({ question_id: id, is_deleted: false })
      .orderBy('sort_order');
    return { ...q, options };
  }

  async findRandomForSession(topicId: number, limit: number): Promise<QuestionWithOptions[]> {
    const questions = await this.db('questions')
      .where({ topic_id: topicId, is_deleted: false })
      .orderByRaw('RANDOM()')
      .limit(limit);

    const questionIds = questions.map((q: QuestionRow) => q.id);
    if (questionIds.length === 0) return [];

    const allOptions = await this.db('answer_options')
      .whereIn('question_id', questionIds)
      .where({ is_deleted: false })
      .orderBy('sort_order');

    const optionsMap = new Map<number, AnswerOptionRow[]>();
    for (const opt of allOptions) {
      const list = optionsMap.get(opt.question_id) ?? [];
      list.push(opt);
      optionsMap.set(opt.question_id, list);
    }

    return questions.map((q: QuestionRow) => ({ ...q, options: optionsMap.get(q.id) ?? [] }));
  }

  async create(
    data: Omit<QuestionRow, 'id' | 'created_at' | 'updated_at'>,
    options: Array<{ body_text: string; is_correct: boolean; sort_order: number }>,
  ): Promise<QuestionRow> {
    return this.db.transaction(async (trx) => {
      const [q] = await trx('questions').insert(data).returning('*');
      await trx('answer_options').insert(options.map((o) => ({ ...o, question_id: q.id })));
      return q;
    });
  }

  async bulkCreate(
    items: Array<{
      question: Omit<QuestionRow, 'id' | 'created_at' | 'updated_at'>;
      options: Array<{ body_text: string; is_correct: boolean; sort_order: number }>;
    }>,
  ): Promise<number> {
    return this.db.transaction(async (trx) => {
      let count = 0;
      for (const item of items) {
        const [q] = await trx('questions').insert(item.question).returning('*');
        await trx('answer_options').insert(item.options.map((o) => ({ ...o, question_id: q.id })));
        count++;
      }
      return count;
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.db('questions').where({ id }).update({ is_deleted: true, updated_at: this.db.fn.now() });
  }

  async updateOption(optionId: number, data: Partial<AnswerOptionRow>): Promise<void> {
    await this.db('answer_options').where({ id: optionId }).update(data);
  }

  async findByTopicPaginated(
    topicId: number,
    page: number,
    limit: number,
  ): Promise<{ rows: QuestionWithOptions[]; total: number }> {
    const [{ count }] = await this.db('questions')
      .where({ topic_id: topicId, is_deleted: false })
      .count('id as count');
    const total = Number(count);

    const questions = await this.db('questions')
      .where({ topic_id: topicId, is_deleted: false })
      .orderBy('sort_order')
      .limit(limit)
      .offset((page - 1) * limit);

    const ids = questions.map((q: QuestionRow) => q.id);
    const allOpts = ids.length
      ? await this.db('answer_options').whereIn('question_id', ids).where({ is_deleted: false }).orderBy('sort_order')
      : [];

    const optMap = new Map<number, AnswerOptionRow[]>();
    for (const opt of allOpts) {
      const arr = optMap.get(opt.question_id) ?? [];
      arr.push(opt);
      optMap.set(opt.question_id, arr);
    }

    const rows = questions.map((q: QuestionRow) => ({ ...q, options: optMap.get(q.id) ?? [] }));
    return { rows, total };
  }
}
