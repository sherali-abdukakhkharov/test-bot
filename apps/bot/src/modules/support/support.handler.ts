import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { SupportRepository } from '@/repositories/support.repository';
import { AdminRepository } from '@/repositories/admin.repository';
import { UserRepository } from '@/repositories/user.repository';
import { RegistrationState } from '@/common/constants/registration-states';
import { CB, cbData, parseCb } from '@/common/constants/callbacks';
import { displayName } from '@/common/utils/format';

@Injectable()
export class SupportHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly supportRepo: SupportRepository,
    private readonly adminRepo: AdminRepository,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // User presses "💬 Yordam"
    bot.hears('💬 Yordam', async (ctx) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) return;

      const existingThread = await this.supportRepo.findOpenThreadByUser(user.id);
      if (existingThread) {
        await ctx.reply(
          '💬 Sizning so\'rovingiz allaqachon ko\'rib chiqilmoqda.\n' +
            'Admin javob bergunga qadar kuting yoki quyidagi xabaringizni yuboring.',
        );
        return;
      }

      const thread = await this.supportRepo.createThread(user.id);
      await ctx.reply(
        `💬 <b>Yordam so'rovi yaratildi!</b>\n\n` +
          `So'rov raqami: <b>#${thread.id}</b>\n\n` +
          `Muammoingizni yoki savolingizni yozing. Admin tez orada javob beradi.`,
        { parse_mode: 'HTML' },
      );

      // Notify all admins
      const admins = await this.adminRepo.findAll();
      const userName = displayName(user.first_name, user.last_name, user.username);
      for (const admin of admins) {
        if (!admin.is_approved || admin.is_blocked) continue;
        try {
          await bot.api.sendMessage(
            admin.telegram_id,
            `🆕 Yangi yordam so\'rovi!\n\n` +
              `👤 Foydalanuvchi: <b>${userName}</b>\n` +
              `🆔 Thread ID: ${thread.id}`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard()
                .text('✅ Qabul qilish', cbData(CB.SUPPORT_CLAIM, String(thread.id)))
                .text('❌ Yopish', cbData(CB.SUPPORT_CLOSE, String(thread.id))),
            },
          );
        } catch {
          // Admin may have blocked the bot — skip
        }
      }
    });

    // User sends a message (when they have an active support thread)
    bot.on('message', async (ctx, next) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) return next();
      if (ctx.dbAdmin) return next(); // admins handled separately

      const thread = await this.supportRepo.findOpenThreadByUser(user.id);
      if (!thread) return next();

      const text = ctx.message.text ?? ctx.message.caption ?? null;
      if (!text && !ctx.message.photo && !ctx.message.document && !ctx.message.voice) return next();

      // Save message
      await this.supportRepo.addMessage({
        thread_id: thread.id,
        sender_type: 'user',
        sender_id: user.id,
        body_text: text,
        media_type: null,
        media_file_id: null,
      });

      // Forward to assigned admin (or all admins if unclaimed)
      const admins = thread.claimed_by
        ? [await this.adminRepo.findById(thread.claimed_by)]
        : await this.adminRepo.findAll();

      for (const admin of admins) {
        if (!admin || !admin.is_approved || admin.is_blocked) continue;
        try {
          const userName = displayName(user.first_name, user.last_name, user.username);
          await bot.api.sendMessage(
            admin.telegram_id,
            `💬 <b>${userName}</b> (Thread #${thread.id}):\n\n${text ?? '[Media]'}`,
            { parse_mode: 'HTML' },
          );
        } catch {
          // skip
        }
      }

      await ctx.reply('✅ Xabaringiz yuborildi. Admin tez orada javob beradi.');
    });

    // Admin claims a thread
    bot.callbackQuery(new RegExp(`^${CB.SUPPORT_CLAIM}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const admin = ctx.dbAdmin;
      if (!admin) {
        await ctx.reply('⛔ Siz admin emassiz.');
        return;
      }

      const { params } = parseCb(ctx.callbackQuery.data);
      const threadId = BigInt(params[0]);

      await this.supportRepo.claimThread(threadId, admin.id);
      await ctx.reply(`✅ Thread #${threadId} siz tomondan qabul qilindi.`);

      // Notify user
      const thread = await this.supportRepo.findThreadById(threadId);
      if (thread) {
        const threadUser = await this.userRepo.findById(thread.user_id);
        if (threadUser) {
          try {
            await bot.api.sendMessage(
              threadUser.telegram_id,
              `👤 So'rov <b>#${threadId}</b> admin tomonidan qabul qilindi. Tez orada javob beriladi.`,
              { parse_mode: 'HTML' },
            );
          } catch {
            // user may have blocked bot
          }
        }
      }
    });

    // Admin closes a thread
    bot.callbackQuery(new RegExp(`^${CB.SUPPORT_CLOSE}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const admin = ctx.dbAdmin;
      if (!admin) return;

      const { params } = parseCb(ctx.callbackQuery.data);
      const threadId = BigInt(params[0]);

      const thread = await this.supportRepo.findThreadById(threadId);
      if (!thread) return;
      if (thread.status === 'closed') {
        await ctx.reply(`ℹ️ Thread #${threadId} allaqachon yopilgan.`);
        return;
      }

      await this.supportRepo.closeThread(threadId);

      // Notify user
      try {
        const threadUser = await this.userRepo.findById(thread.user_id);
        if (threadUser) {
          await bot.api.sendMessage(
            threadUser.telegram_id,
            `✅ So'rov <b>#${threadId}</b> yopildi. Agar boshqa savollaringiz bo'lsa, "💬 Yordam" tugmasini bosing.`,
            { parse_mode: 'HTML' },
          );
        }
      } catch {
        // user may have blocked bot
      }

      await ctx.reply(`✅ Thread #${threadId} yopildi.`);
    });
  }
}
