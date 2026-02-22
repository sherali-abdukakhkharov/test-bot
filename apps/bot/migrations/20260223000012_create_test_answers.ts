import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('test_answers', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('session_id')
      .notNullable()
      .references('id')
      .inTable('test_sessions')
      .onDelete('CASCADE');
    t.bigInteger('question_id')
      .notNullable()
      .references('id')
      .inTable('questions')
      .onDelete('RESTRICT');
    t.text('question_snapshot').notNullable().comment('Copy of question body_text at answer time');
    t.bigInteger('chosen_option_id')
      .nullable()
      .references('id')
      .inTable('answer_options')
      .onDelete('SET NULL')
      .comment('NULL = unanswered (abandoned)');
    t.text('chosen_option_text').nullable().comment('Copy of chosen option text — survives deletion');
    t.text('correct_option_text')
      .notNullable()
      .comment('Copy of correct option text — survives deletion');
    t.boolean('is_correct').notNullable().defaultTo(false);
    t.timestamp('answered_at').nullable().comment('NULL = unanswered');
    t.specificType('time_spent_sec', 'smallint').nullable();

    t.unique(['session_id', 'question_id'], { indexName: 'uq_test_answers_session_question' });
    t.index(['session_id'], 'idx_test_answers_session_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('test_answers');
}
