import type { Knex } from 'knex';

/**
 * Seed placeholder sticker records.
 * Replace the file_id values with real Telegram sticker file_ids before production.
 * Bot will fall back to plain text messages if a sticker is not found.
 */
export async function seed(knex: Knex): Promise<void> {
  const rows = await knex('stickers').select('type');
  const existingTypes = new Set(rows.map((r: { type: string }) => r.type));

  const placeholders: Array<{ type: string; file_id: string }> = [
    { type: 'welcome', file_id: 'PLACEHOLDER_WELCOME' },
    { type: 'correct', file_id: 'PLACEHOLDER_CORRECT' },
    { type: 'wrong', file_id: 'PLACEHOLDER_WRONG' },
    { type: 'finish', file_id: 'PLACEHOLDER_FINISH' },
  ];

  const toInsert = placeholders.filter((p) => !existingTypes.has(p.type));
  if (toInsert.length > 0) {
    await knex('stickers').insert(toInsert);
  }
}
