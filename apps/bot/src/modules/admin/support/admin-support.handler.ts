import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { SupportRepository } from '@/repositories/support.repository';
import { UserRepository } from '@/repositories/user.repository';
import { displayName } from '@/common/utils/format';

@Injectable()
export class AdminSupportHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly supportRepo: SupportRepository,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears('💬 Yordam', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showOpenThreads(ctx);
    });

    bot.command('support', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showOpenThreads(ctx);
    });

    bot.callbackQuery(/^admin_view_thread:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const threadId = BigInt(ctx.callbackQuery.data.split(':')[1]);
      await this.showThread(ctx, threadId);
    });

    // Admin replies to a thread
    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();
      if (ctx.session.adminStep !== 'support_reply') return next();

      const wizard = ctx.session.adminWizard ?? {};
      const threadId = BigInt(wizard.threadId as string);

      const thread = await this.supportRepo.findThreadById(threadId);
      if (!thread || thread.status === 'closed') {
        await ctx.reply("❌ Thread yopilgan yoki topilmadi.");
        ctx.session.adminStep = undefined;
        return;
      }

      const text = ctx.message.text;
      await this.supportRepo.addMessage({
        thread_id: threadId,
        sender_type: 'admin',
        sender_id: BigInt(ctx.dbAdmin.id),
        body_text: text,
        media_type: null,
        media_file_id: null,
      });

      // Auto-claim
      if (thread.status === 'open') {
        await this.supportRepo.claimThread(threadId, ctx.dbAdmin.id);
      }

      // Send to user
      try {
        const adminName = displayName(ctx.dbAdmin.first_name, ctx.dbAdmin.last_name, ctx.dbAdmin.username);
        await bot.api.sendMessage(
          String(thread.user_id),
          `💬 <b>Admin</b> (${adminName}):\n\n${text}`,
          { parse_mode: 'HTML' },
        );
      } catch {
        // user may have blocked bot
      }

      ctx.session.adminStep = undefined;
      ctx.session.adminWizard = {};
      await ctx.reply('✅ Javob yuborildi.');
      return;
    });
  }

  private async showOpenThreads(ctx: any) {
    const { rows, total } = await this.supportRepo.findThreads('open', 1, 10);
    const claimed = await this.supportRepo.findThreads('claimed', 1, 10);

    const all = [...rows, ...claimed.rows];

    let text = `💬 <b>Yordam so'rovlari</b>\n\n`;
    const kb = new InlineKeyboard();

    if (all.length === 0) {
      text += 'Faol so\'rovlar yo\'q.';
    }

    for (const thread of all) {
      const user = await this.userRepo.findByTelegramId(String(thread.user_id));
      const name = user ? displayName(user.first_name, user.last_name, user.username) : `User ${thread.user_id}`;
      const statusIcon = thread.status === 'open' ? '🔴' : '🟡';
      text += `${statusIcon} ${name} — Thread #${thread.id}\n`;
      kb.text(`${statusIcon} ${name.slice(0, 20)}`, `admin_view_thread:${thread.id}`).row();
    }

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }

  private async showThread(ctx: any, threadId: bigint) {
    const messages = await this.supportRepo.getMessages(threadId, 20);
    let text = `💬 <b>Thread #${threadId}</b>\n\n`;

    for (const msg of messages) {
      const icon = msg.sender_type === 'user' ? '👤' : '👨‍💼';
      text += `${icon} ${msg.body_text ?? '[Media]'}\n`;
    }

    const kb = new InlineKeyboard()
      .text('✍️ Javob yozish', `start_support_reply:${threadId}`)
      .text('✅ Yopish', `admin_close_thread:${threadId}`);

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
