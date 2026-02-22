import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('telegram_id').notNullable().unique();
    t.string('first_name', 100).nullable();
    t.string('last_name', 100).nullable();
    t.string('name_script', 20).nullable().comment('"latin", "cyrillic", or "arabic"');
    t.string('registration_state', 30)
      .notNullable()
      .defaultTo('not_registered')
      .comment('"not_registered" | "name_entered" | "confirmed"');
    t.boolean('is_blocked').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['telegram_id'], 'idx_users_telegram_id');
    t.index(['registration_state'], 'idx_users_registration_state');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('users');
}
