/** Escape special MarkdownV2 characters */
export function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/** Format a score as percentage string */
export function formatScore(correct: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((correct / total) * 100)}%`;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLen = 100): string {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
}

/** Format user display name */
export function displayName(
  firstName: string | null,
  lastName: string | null,
  username: string | null,
): string {
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }
  return username ? `@${username}` : 'Noma\'lum';
}
