/**
 * Callback data prefixes and builders for inline keyboards.
 * Format: PREFIX:param1:param2
 */
export const CB = {
  // Navigation
  SECTION: 'sec',
  TOPIC: 'top',
  BACK_SECTIONS: 'back_sec',
  BACK_TOPICS: 'back_top',

  // Test
  START_TEST: 'start_test',
  ANSWER: 'ans',
  NEXT_QUESTION: 'next_q',
  FINISH_TEST: 'finish_test',

  // Admin
  ADMIN_APPROVE: 'adm_approve',
  ADMIN_REJECT: 'adm_reject',
  ADMIN_BLOCK: 'adm_block',

  // Support
  SUPPORT_CLAIM: 'sup_claim',
  SUPPORT_CLOSE: 'sup_close',
} as const;

export function cbData(prefix: string, ...params: (string | number)[]): string {
  return [prefix, ...params].join(':');
}

export function parseCb(data: string): { prefix: string; params: string[] } {
  const [prefix, ...params] = data.split(':');
  return { prefix, params };
}
