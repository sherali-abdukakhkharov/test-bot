import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { AnnouncementRepository } from '@/repositories/announcement.repository';
import { UserRepository } from '@/repositories/user.repository';

@Injectable()
export class AdminAnnouncementsHandler implements OnModuleInit {
  private readonly logger = new Logger(AdminAnnouncementsHandler.name);

  constructor(
    private readonly botService: BotService,
    private readonly announcementRepo: AnnouncementRepository,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears("📢 E'lon", async (ctx) => {
      if (!ctx.dbAdmin) return;
      ctx.session.adminStep = 'announce_text';
      await ctx.reply(
        "📢 <b>Yangi e'lon</b>\n\nXabar matnini kiriting (yoki /skip):",
        { parse_mode: 'HTML' },
      );
    });

    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();

      if (ctx.session.adminStep === 'announce_text') {
        const text = ctx.message.text === '/skip' ? null : ctx.message.text.trim();
        ctx.session.adminWizard = { text };
        ctx.session.adminStep = 'announce_confirm';

        const preview = text ?? '[Media xabar]';
        const kb = new InlineKeyboard()
          .text("✅ Yuborish", 'announce_send')
          .text('❌ Bekor', 'announce_cancel');

        await ctx.reply(
          `📢 <b>E'lon ko'rinishi:</b>\n\n${preview}\n\nYuborilsinmi?`,
          { parse_mode: 'HTML', reply_markup: kb },
        );
        return;
      }

      return next();
    });

    bot.callbackQuery('announce_send', async (ctx) => {
      await ctx.answerCallbackQuery('Yuborilmoqda...');
      if (!ctx.dbAdmin) return;

      const wizard = ctx.session.adminWizard ?? {};
      const text = wizard.text as string | null;

      const admin = ctx.dbAdmin;

      // Save announcement
      await this.announcementRepo.create({
        created_by: admin.id,
        body_text: text,
        media_type: null,
        media_file_id: null,
        expires_at: null,
      });

      ctx.session.adminStep = undefined;
      ctx.session.adminWizard = {};

      await ctx.reply("📤 E'lon yuborilmoqda...");

      // Broadcast in background
      this.broadcastAnnouncement(text).then((result) => {
        const bot = this.botService.bot;
        bot.api
          .sendMessage(
            ctx.from!.id,
            `✅ E'lon yuborildi!\n📊 Yuborildi: ${result.sent}\n❌ Xato: ${result.failed}`,
          )
          .catch(() => {});
      });
    });

    bot.callbackQuery('announce_cancel', async (ctx) => {
      await ctx.answerCallbackQuery();
      ctx.session.adminStep = undefined;
      ctx.session.adminWizard = {};
      await ctx.reply("❌ E'lon bekor qilindi.");
    });
  }

  private async broadcastAnnouncement(text: string | null): Promise<{ sent: number; failed: number }> {
    const bot = this.botService.bot;
    const { rows: users } = await this.userRepo.findAll({ page: 1, limit: 100000 });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (user.is_blocked) continue;
      try {
        await bot.api.sendMessage(user.telegram_id, text ?? '📢 Yangi e\'lon', {
          parse_mode: 'HTML',
        });
        sent++;
        // Small delay to avoid flood
        await new Promise((r) => setTimeout(r, 35));
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }
}
