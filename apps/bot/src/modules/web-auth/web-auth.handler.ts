import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { OtpService } from '@/api/auth/otp.service';

@Injectable()
export class WebAuthHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly otpService: OtpService,
  ) {}

  private async sendOtp(ctx: import('@/bot/context.type').BotContext): Promise<void> {
    const admin = ctx.dbAdmin;
    if (!admin || !admin.is_approved || admin.is_blocked) {
      await ctx.reply('⛔ Bu buyruq faqat tasdiqlangan adminlar uchun.');
      return;
    }
    const code = this.otpService.generate(admin);
    await ctx.reply(
      `🔐 *Web panel uchun kodingiz:*\n\n\`${code}\`\n\n⏰ Bu kod 15 soniya ichida kiritilishi kerak\\.`,
      { parse_mode: 'MarkdownV2' },
    );
  }

  onModuleInit() {
    const bot = this.botService.bot;

    // /weblogin command
    bot.command('weblogin', (ctx) => this.sendOtp(ctx));

    // "🌐 Web Panel kirish" menu button (same logic)
    bot.hears('🌐 Web Panel kirish', (ctx) => this.sendOtp(ctx));
  }
}
