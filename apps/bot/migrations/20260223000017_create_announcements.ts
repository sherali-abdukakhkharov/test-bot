import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('announcements', (t) => {
    t.bigIncrements('id').primary();
    t.integer('created_by')
      .notNullable()
      .references('id')
      .inTable('admins')
      .onDelete('RESTRICT');
    t.text('body_text').nullable();
    t.string('media_type', 20).nullable().comment('"image" | "video" | "file" | NULL');
    t.string('media_file_id', 200).nullable();
    t.timestamp('expires_at')
      .notNullable()
      .comment('Set to created_at + 24h by application');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['expires_at'], 'idx_announcements_expires_at');
    t.index(['created_by'], 'idx_announcements_created_by');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('announcements');
}
