import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stickers', (t) => {
    t.increments('id').primary();
    t.string('type', 20).notNullable().comment('"correct" or "wrong"');
    t.string('file_id', 200).notNullable().comment('Telegram sticker file_id');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['type'], 'idx_stickers_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('stickers');
}
