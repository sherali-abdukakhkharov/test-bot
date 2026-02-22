import { MiddlewareFn } from 'grammy';
import { BotContext } from '../context.type';
import { UserRepository } from '@/repositories/user.repository';

/**
 * Upserts the Telegram user in the database on every update and attaches
 * the DB row to `ctx.dbUser`. Also blocks interaction if user is blocked.
 */
export function userMiddleware(userRepo: UserRepository): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();

    const dbUser = await userRepo.upsert({
      telegram_id: String(from.id),
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
      username: from.username ?? null,
      language_code: from.language_code ?? null,
    });

    ctx.dbUser = dbUser;

    if (dbUser.is_blocked) {
      await ctx.reply('❌ Siz bloklangansiz. Iltimos, administratorga murojaat qiling.');
      return;
    }

    return next();
  };
}
