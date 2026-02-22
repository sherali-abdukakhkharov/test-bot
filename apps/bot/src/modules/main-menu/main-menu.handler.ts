import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { RegistrationState } from '@/common/constants/registration-states';
import { mainMenuKeyboard } from '@/common/utils/keyboard';

@Injectable()
export class MainMenuHandler implements OnModuleInit {
  constructor(private readonly botService: BotService) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // Guard: only registered users can access the main menu
    bot.on('message:text', async (ctx, next) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) {
        return next();
      }

      const text = ctx.message.text;

      if (text === '📚 Test ishlash') {
        // Handled by navigation module — just pass through
        return next();
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

      // Unknown text from registered user — show menu
      await ctx.reply('Asosiy menyu:', { reply_markup: mainMenuKeyboard() });
    });
  }
}
