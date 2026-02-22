import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('daily_attempt_counts', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('topic_id').notNullable().references('id').inTable('topics').onDelete('CASCADE');
    t.date('attempt_date')
      .notNullable()
      .comment('Calendar date in Asia/Tashkent (UTC+5)');
    t.specificType('count', 'smallint').notNullable().defaultTo(1);

    t.unique(['user_id', 'topic_id', 'attempt_date'], {
      indexName: 'uq_daily_attempt_counts',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('daily_attempt_counts');
}
