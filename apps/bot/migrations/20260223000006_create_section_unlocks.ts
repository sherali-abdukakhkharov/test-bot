import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('section_unlocks', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('section_id')
      .notNullable()
      .references('id')
      .inTable('sections')
      .onDelete('CASCADE');
    t.timestamp('unlocked_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['user_id', 'section_id'], { indexName: 'uq_section_unlocks_user_section' });
    t.index(['section_id'], 'idx_section_unlocks_section');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('section_unlocks');
}
