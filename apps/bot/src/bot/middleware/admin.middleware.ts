import { MiddlewareFn } from 'grammy';
import { BotContext } from '../context.type';
import { AdminRepository } from '@/repositories/admin.repository';

/**
 * Attaches `ctx.dbAdmin` if the sender is a known, approved, non-blocked admin.
 * Does NOT block the middleware chain — callers must check `ctx.dbAdmin`.
 */
export function adminMiddleware(adminRepo: AdminRepository): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;
    if (from) {
      const admin = await adminRepo.findByTelegramId(String(from.id));
      if (admin && admin.is_approved && !admin.is_blocked) {
        ctx.dbAdmin = admin;
      }
    }
    return next();
  };
}
