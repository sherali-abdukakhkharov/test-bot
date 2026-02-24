import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { RegistrationState } from '@/common/constants/registration-states';
import { adminMenuKeyboard, mainMenuKeyboard } from '@/common/utils/keyboard';

@Injectable()
export class MainMenuHandler implements OnModuleInit {
  constructor(private readonly botService: BotService) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.on('message:text', async (ctx, next) => {
      const text = ctx.message.text;

      // Admin flow: approved admins get their own minimal menu
      if (ctx.dbAdmin) {
        // Pass through commands and the web-panel button (handled by WebAuthHandler)
        if (text.startsWith('/') || text === '🌐 Web Panel kirish') {
          return next();
        }
        // Any other text → show admin menu
        await ctx.reply('Admin menyu:', { reply_markup: adminMenuKeyboard() });
        return;
      }

      // Regular user flow — only registered users see the main menu
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) {
        return next();
      }

      if (text === '📚 Test ishlash') {
        return next(); // handled by navigation module
      }

      if (text === '📖 Qo\'llanma') {
        return next(); // handled by guide module
      }

      if (text === '📊 Natijalar') {
        return next(); // handled by leaderboard module
      }

      if (text === '💬 Yordam') {
        return next(); // handled by support module
      }

      // Pass through commands
      if (text.startsWith('/')) {
        return next();
      }

      // Unknown text from registered user — show menu
      await ctx.reply('Asosiy menyu:', { reply_markup: mainMenuKeyboard() });
    });
  }
}
