import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('username', 100).nullable().after('last_name');
    t.string('language_code', 10).nullable().after('username');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('username');
    t.dropColumn('language_code');
  });
}
