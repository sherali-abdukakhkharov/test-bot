import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('questions', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('topic_id').notNullable().references('id').inTable('topics').onDelete('CASCADE');
    t.text('body_text').nullable().comment('At least one of body_text or media_file_id must be set');
    t.string('media_type', 20).nullable().comment('"image" | "audio" | "video" | NULL');
    t.string('media_file_id', 200).nullable().comment('Telegram file_id for media attachment');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['topic_id'], 'idx_questions_topic_id');
    t.index(['topic_id', 'is_deleted'], 'idx_questions_topic_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('questions');
}
