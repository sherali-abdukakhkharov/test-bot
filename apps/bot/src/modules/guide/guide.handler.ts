import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { GuideRepository } from '@/repositories/guide.repository';
import { RegistrationState } from '@/common/constants/registration-states';

@Injectable()
export class GuideHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly guideRepo: GuideRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears("📖 Qo'llanma", async (ctx) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) return;

      const items = await this.guideRepo.findActive();
      if (items.length === 0) {
        await ctx.reply("📭 Qo'llanma hali to'ldirilmagan.");
        return;
      }

      await ctx.reply("📖 <b>Qo'llanma:</b>", { parse_mode: 'HTML' });

      for (const item of items) {
        if (item.content_type === 'text' && item.body_text) {
          await ctx.reply(item.body_text);
        } else if (item.content_type === 'video' && item.media_file_id) {
          await ctx.replyWithVideo(item.media_file_id, {
            caption: item.body_text ?? undefined,
          });
        }
      }
    });
  }
}
