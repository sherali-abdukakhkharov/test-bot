import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { UserRepository } from '@/repositories/user.repository';
import { displayName } from '@/common/utils/format';

@Injectable()
export class AdminUsersHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears('👥 Foydalanuvchilar', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listUsers(ctx, 1);
    });

    bot.command('users', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listUsers(ctx, 1);
    });

    bot.callbackQuery(/^admin_users_page:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const page = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      await this.listUsers(ctx, page);
    });

    bot.callbackQuery(/^admin_block_user:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const tgId = ctx.callbackQuery.data.split(':')[1];
      const user = await this.userRepo.findByTelegramId(tgId);
      if (!user) return;
      const newBlocked = !user.is_blocked;
      await this.userRepo.setBlocked(tgId, newBlocked);
      await ctx.reply(newBlocked ? `⛔ Foydalanuvchi bloklandi.` : `✅ Foydalanuvchi blokdan chiqarildi.`);
    });
  }

  private async listUsers(ctx: any, page: number) {
    const limit = 10;
    const { rows, total } = await this.userRepo.findAll({ page, limit });

    let text = `👥 <b>Foydalanuvchilar</b> (${total} ta)\n\n`;
    const kb = new InlineKeyboard();

    for (const u of rows) {
      const name = displayName(u.first_name, u.last_name, u.username);
      const blockedMark = u.is_blocked ? '⛔ ' : '';
      text += `${blockedMark}${name} — <code>${u.telegram_id}</code>\n`;
      kb.text(`${u.is_blocked ? '✅' : '⛔'} ${name.slice(0, 15)}`, `admin_block_user:${u.telegram_id}`).row();
    }

    const totalPages = Math.ceil(total / limit);
    if (totalPages > 1) {
      if (page > 1) kb.text('⬅️', `admin_users_page:${page - 1}`);
      kb.text(`${page}/${totalPages}`, 'noop');
      if (page < totalPages) kb.text('➡️', `admin_users_page:${page + 1}`);
    }

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
