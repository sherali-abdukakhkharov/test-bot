import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sections', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('parent_id').nullable().references('id').inTable('sections').onDelete('SET NULL');
    t.string('title', 255).notNullable();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_locked_by_default').notNullable().defaultTo(false);
    t.bigInteger('unlock_required_section')
      .nullable()
      .references('id')
      .inTable('sections')
      .onDelete('SET NULL');
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['parent_id'], 'idx_sections_parent_id');
    t.index(['unlock_required_section'], 'idx_sections_unlock_required');
    t.index(['parent_id', 'sort_order'], 'idx_sections_parent_order');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('sections');
}
