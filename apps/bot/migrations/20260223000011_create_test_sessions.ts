import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('test_sessions', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('topic_id').notNullable().references('id').inTable('topics').onDelete('RESTRICT');
    t.string('status', 20)
      .notNullable()
      .defaultTo('in_progress')
      .comment('"in_progress" | "completed" | "abandoned"');
    t.specificType('total_questions', 'smallint').notNullable();
    t.specificType('correct_count', 'smallint').notNullable().defaultTo(0);
    t.specificType('wrong_count', 'smallint').notNullable().defaultTo(0);
    t.decimal('score_percent', 5, 2).notNullable().defaultTo(0);
    t.date('attempt_date_tashkent')
      .notNullable()
      .comment('Calendar date in Asia/Tashkent (UTC+5), set at session start');
    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('finished_at').nullable();

    t.index(['user_id'], 'idx_test_sessions_user_id');
    t.index(['topic_id'], 'idx_test_sessions_topic_id');
    t.index(['user_id', 'topic_id', 'attempt_date_tashkent'], 'idx_test_sessions_daily');
    t.index(['user_id', 'started_at'], 'idx_test_sessions_user_history');
    t.index(['user_id', 'topic_id', 'score_percent'], 'idx_test_sessions_best_score');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('test_sessions');
}
