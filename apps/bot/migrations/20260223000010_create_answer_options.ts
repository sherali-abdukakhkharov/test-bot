import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('answer_options', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('question_id')
      .notNullable()
      .references('id')
      .inTable('questions')
      .onDelete('CASCADE');
    t.text('body_text').notNullable();
    t.boolean('is_correct').notNullable().defaultTo(false);
    t.specificType('sort_order', 'smallint').notNullable().defaultTo(0);
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['question_id'], 'idx_answer_options_question_id');
    t.index(['question_id', 'is_correct'], 'idx_answer_options_correct');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('answer_options');
}
