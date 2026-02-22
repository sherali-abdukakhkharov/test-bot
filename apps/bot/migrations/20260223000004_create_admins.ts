import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('admins', (t) => {
    t.increments('id').primary();
    t.bigInteger('telegram_id').notNullable().unique();
    t.string('role', 20).notNullable().comment('"super" or "regular"');
    t.boolean('is_approved').notNullable().defaultTo(false);
    t.boolean('is_blocked').notNullable().defaultTo(false);
    t.specificType('failed_attempt_count', 'smallint').notNullable().defaultTo(0);
    t.string('password_hash', 255).nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['telegram_id'], 'idx_admins_telegram_id');
    t.index(['role'], 'idx_admins_role');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('admins');
}
