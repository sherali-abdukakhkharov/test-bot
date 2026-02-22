import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('topic_unlocks', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('topic_id').notNullable().references('id').inTable('topics').onDelete('CASCADE');
    t.timestamp('unlocked_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['user_id', 'topic_id'], { indexName: 'uq_topic_unlocks_user_topic' });
    t.index(['topic_id'], 'idx_topic_unlocks_topic');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('topic_unlocks');
}
