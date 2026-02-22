import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('guide_items', (t) => {
    t.increments('id').primary();
    t.string('content_type', 10).notNullable().comment('"text" or "video"');
    t.text('body_text').nullable().comment('Populated when content_type = "text"');
    t.string('media_file_id', 200)
      .nullable()
      .comment('Telegram file_id when content_type = "video"');
    t.specificType('sort_order', 'smallint')
      .notNullable()
      .comment('Admin-defined display order; max 20 rows enforced at app layer');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['sort_order'], 'idx_guide_items_sort_order');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('guide_items');
}
