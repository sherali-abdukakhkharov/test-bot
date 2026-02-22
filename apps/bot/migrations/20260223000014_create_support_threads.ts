import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('support_threads', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('status', 20)
      .notNullable()
      .defaultTo('open')
      .comment('"open" | "claimed" | "closed"');
    t.integer('claimed_by')
      .nullable()
      .references('id')
      .inTable('admins')
      .onDelete('SET NULL')
      .comment('First admin to respond claims the thread');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['user_id'], 'idx_support_threads_user_id');
    t.index(['status'], 'idx_support_threads_status');
    t.index(['claimed_by'], 'idx_support_threads_claimed_by');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('support_threads');
}
