import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { SettingsRepository } from '@/repositories/settings.repository';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminSettingsHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly settingsRepo: SettingsRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears('⚙️ Sozlamalar', async (ctx) => {
      if (!ctx.dbAdmin) return;
      if (ctx.dbAdmin.role !== 'super') {
        await ctx.reply('⛔ Bu bo\'lim faqat Super Admin uchun.');
        return;
      }

      const { InlineKeyboard } = await import('grammy');
      const kb = new InlineKeyboard()
        .text("🔑 Admin parolini o'zgartirish", 'settings_change_admin_pw').row()
        .text("🔑 Super admin parolini o'zgartirish", 'settings_change_super_pw').row();

      await ctx.reply('⚙️ <b>Sozlamalar</b>', { parse_mode: 'HTML', reply_markup: kb });
    });

    bot.callbackQuery('settings_change_admin_pw', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin || ctx.dbAdmin.role !== 'super') return;
      ctx.session.adminStep = 'settings_new_admin_pw';
      await ctx.reply('Yangi admin parolini kiriting:');
    });

    bot.callbackQuery('settings_change_super_pw', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin || ctx.dbAdmin.role !== 'super') return;
      ctx.session.adminStep = 'settings_new_super_pw';
      await ctx.reply('Yangi super admin parolini kiriting:');
    });

    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin || ctx.dbAdmin.role !== 'super') return next();

      if (ctx.session.adminStep === 'settings_new_admin_pw') {
        const hash = await bcrypt.hash(ctx.message.text.trim(), 10);
        await this.settingsRepo.set('admin_shared_password', hash);
        ctx.session.adminStep = undefined;
        await ctx.reply('✅ Admin paroli yangilandi!');
        return;
      }

      if (ctx.session.adminStep === 'settings_new_super_pw') {
        const hash = await bcrypt.hash(ctx.message.text.trim(), 10);
        await this.settingsRepo.set('super_admin_password', hash);
        ctx.session.adminStep = undefined;
        await ctx.reply('✅ Super admin paroli yangilandi!');
        return;
      }

      return next();
    });
  }
}
