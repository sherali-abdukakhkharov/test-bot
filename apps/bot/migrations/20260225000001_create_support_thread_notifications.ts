import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('support_thread_notifications', (t) => {
    t.increments('id').primary();
    t.bigInteger('thread_id').notNullable().references('id').inTable('support_threads').onDelete('CASCADE');
    t.bigInteger('admin_telegram_id').notNullable();
    t.bigInteger('message_id').notNullable();
    t.index(['thread_id'], 'idx_stn_thread_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('support_thread_notifications');
}
