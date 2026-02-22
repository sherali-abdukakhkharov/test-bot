import { MiddlewareFn } from 'grammy';
import { Logger } from '@nestjs/common';
import { BotContext } from '../context.type';

const logger = new Logger('BotUpdate');

export function loggerMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;
    const update = ctx.update;
    const updateType = Object.keys(update).find((k) => k !== 'update_id') ?? 'unknown';
    const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? '';
    logger.verbose(`[${updateType}] from=${from?.id} text="${text}"`);
    return next();
  };
}
