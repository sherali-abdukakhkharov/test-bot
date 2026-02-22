import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { UserRepository } from '@/repositories/user.repository';
import { RegistrationState } from '@/common/constants/registration-states';
import { mainMenuKeyboard } from '@/common/utils/keyboard';

/** Detect which script the name is written in */
function detectScript(name: string): 'latin' | 'cyrillic' | 'arabic' {
  if (/[\u0600-\u06FF]/.test(name)) return 'arabic';
  if (/[А-Яа-яЁёҒғҚқҲҳҮүЎў]/.test(name)) return 'cyrillic';
  return 'latin';
}

/** Validate name per spec rules */
function validateName(text: string): { valid: boolean; hint?: string } {
  if (text.startsWith('/')) return { valid: false };

  // Reject emoji
  if (/\p{Emoji_Presentation}/u.test(text)) {
    return { valid: false, hint: 'Emoji ishlatish mumkin emas.' };
  }

  const words = text.trim().split(/\s+/);
  if (words.length < 2) {
    return { valid: false, hint: 'Ism va familiyangizni kiriting.' };
  }
  if (words.some((w) => w.length < 2)) {
    return { valid: false, hint: "Har bir so'z kamida 2 harfdan iborat bo'lishi kerak." };
  }
  if (/\d/.test(text)) {
    return { valid: false, hint: 'Raqam ishlatish mumkin emas.' };
  }
  if (!/^[A-Za-zА-Яа-яЁёҒғҚқҲҳҮүЎў\u0600-\u06FF\s'ʻ]+$/.test(text)) {
    return { valid: false, hint: 'Faqat harf va apostrof ishlatish mumkin.' };
  }

  return { valid: true };
}

/** Auto-capitalize each word */
function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

@Injectable()
export class RegistrationHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // /start command
    bot.command('start', async (ctx) => {
      const user = ctx.dbUser;
      if (!user) return;

      if (user.registration_state === RegistrationState.REGISTERED) {
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
        await ctx.reply(
          `👋 Xush kelibsiz, <b>${name}</b>!\n\nAsosiy menyu:`,
          { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
        );
        return;
      }

      // Message 1: bot description
      await ctx.reply(
        `🌟 <b>Arab Tili Yordamchi Bot</b>ga xush kelibsiz!\n\n` +
          `Bu bot sizga arab tilini o'rganishda yordam beradi:\n` +
          `📚 Testlar ishlash\n` +
          `📖 Qo'llanmani ko'rish\n` +
          `📊 Natijalarni kuzatish`,
        { parse_mode: 'HTML' },
      );

      // Message 2: ask for name
      await this.userRepo.updateState(user.telegram_id, RegistrationState.NOT_REGISTERED);
      await ctx.reply(
        `Iltimos, <b>ism-familiyangiz</b> bilan ro'yxatdan o'ting.\n\nNamuna: <i>Abdulloh Karimov</i>`,
        { parse_mode: 'HTML' },
      );
    });

    // Name text input handler
    bot.on('message:text', async (ctx, next) => {
      const user = ctx.dbUser;
      if (!user) return next();

      const state = user.registration_state;
      if (
        state !== RegistrationState.NOT_REGISTERED &&
        state !== RegistrationState.NAME_ENTERED
      ) {
        return next();
      }

      const text = ctx.message.text.trim();
      const { valid, hint } = validateName(text);

      if (!valid) {
        await ctx.reply(
          `❌ Noto'g'ri format. ${hint ?? ''}\n\nNamuna: <i>Abdulloh Karimov</i>`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      const name = capitalizeName(text);
      ctx.session.pendingName = name;
      await this.userRepo.updateState(user.telegram_id, RegistrationState.NAME_ENTERED);

      await ctx.reply(
        `Sizning ismingiz: <b>${name}</b>\n\nTo'g'rimi?`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Ha, to'g'ri", callback_data: 'confirm_name:yes' },
              { text: "❌ Yo'q, qayta", callback_data: 'confirm_name:no' },
            ]],
          },
        },
      );
    });

    // Confirmed — YES
    bot.callbackQuery('confirm_name:yes', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser;
      if (!user) return;

      const fullName = ctx.session.pendingName;
      if (!fullName) {
        await ctx.reply("Xato yuz berdi. Iltimos, /start bosing.");
        return;
      }

      const words = fullName.trim().split(/\s+/);
      const firstName = words[0];
      const lastName = words.slice(1).join(' ') || null;
      const script = detectScript(fullName);

      await this.userRepo.completeRegistration(user.telegram_id, firstName, lastName, script);
      ctx.session.pendingName = undefined;

      await ctx.editMessageText(
        `🎉 <b>Hurmatli ${fullName}, ro'yxatdan o'tdingiz!</b>`,
        { parse_mode: 'HTML' },
      );
      await ctx.reply("Asosiy menyu:", { reply_markup: mainMenuKeyboard() });
    });

    // Confirmed — NO (re-enter name)
    bot.callbackQuery('confirm_name:no', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser;
      if (!user) return;

      ctx.session.pendingName = undefined;
      await this.userRepo.updateState(user.telegram_id, RegistrationState.NOT_REGISTERED);

      await ctx.editMessageText(
        `Iltimos, ism-familiyangizni namunadagidek qaytadan kiriting.\n\nNamuna: <i>Abdulloh Karimov</i>`,
        { parse_mode: 'HTML' },
      );
    });
  }
}
