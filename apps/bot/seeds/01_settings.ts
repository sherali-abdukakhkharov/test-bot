import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Only insert if not already seeded (idempotent)
  const rows = await knex('settings').select('key');
  const existingKeys = new Set(rows.map((r: { key: string }) => r.key));

  const defaults: Array<{ key: string; value: string }> = [
    { key: 'admin_shared_password', value: 'changeme' },
    { key: 'super_admin_password', value: 'changeme_super' },
    { key: 'registration_open', value: 'true' },
  ];

  const toInsert = defaults.filter((d) => !existingKeys.has(d.key));
  if (toInsert.length > 0) {
    await knex('settings').insert(toInsert);
  }
}
