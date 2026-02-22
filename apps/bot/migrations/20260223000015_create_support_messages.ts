import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('support_messages', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('thread_id')
      .notNullable()
      .references('id')
      .inTable('support_threads')
      .onDelete('CASCADE');
    t.string('sender_type', 10).notNullable().comment('"user" or "admin"');
    t.bigInteger('sender_id')
      .notNullable()
      .comment('users.telegram_id if sender_type=user; admins.id if sender_type=admin');
    t.text('body_text').nullable();
    t.string('media_type', 20)
      .nullable()
      .comment('"image" | "file" | "audio" | "voice" — admin only');
    t.string('media_file_id', 200).nullable();
    t.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());

    t.index(['thread_id'], 'idx_support_messages_thread_id');
    t.index(['thread_id', 'sent_at'], 'idx_support_messages_thread_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('support_messages');
}
