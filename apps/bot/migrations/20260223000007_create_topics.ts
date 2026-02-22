import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('topics', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('section_id')
      .notNullable()
      .references('id')
      .inTable('sections')
      .onDelete('CASCADE');
    t.string('title', 255).notNullable();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.specificType('time_per_question_sec', 'smallint').notNullable().defaultTo(30);
    t.specificType('options_count', 'smallint').notNullable().defaultTo(4);
    t.specificType('daily_attempt_limit', 'smallint').notNullable().defaultTo(3);
    t.boolean('is_locked_by_default').notNullable().defaultTo(false);
    t.bigInteger('unlock_required_topic')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['section_id'], 'idx_topics_section_id');
    t.index(['unlock_required_topic'], 'idx_topics_unlock_required');
    t.index(['section_id', 'sort_order'], 'idx_topics_section_order');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('topics');
}
