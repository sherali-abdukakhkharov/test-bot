import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('admins', (t) => {
    t.string('first_name', 100).nullable().after('telegram_id');
    t.string('last_name', 100).nullable().after('first_name');
    t.string('username', 100).nullable().after('last_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('admins', (t) => {
    t.dropColumn('first_name');
    t.dropColumn('last_name');
    t.dropColumn('username');
  });
}
