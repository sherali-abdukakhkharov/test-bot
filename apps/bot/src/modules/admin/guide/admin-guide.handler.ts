import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { GuideRepository } from '@/repositories/guide.repository';

const MAX_GUIDE_ITEMS = 20;

@Injectable()
export class AdminGuideHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly guideRepo: GuideRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears("📖 Qo'llanma", async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listGuideItems(ctx);
    });

    bot.command('guide', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listGuideItems(ctx);
    });

    bot.callbackQuery('admin_add_guide', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const count = await this.guideRepo.count();
      if (count >= MAX_GUIDE_ITEMS) {
        await ctx.reply(`⛔ Maksimal ${MAX_GUIDE_ITEMS} ta element qo'shish mumkin.`);
        return;
      }
      ctx.session.adminStep = 'guide_type';
      const kb = new InlineKeyboard()
        .text('📝 Matn', 'guide_type:text')
        .text('🎥 Video', 'guide_type:video');
      await ctx.reply("Qo'llanma turi?", { reply_markup: kb });
    });

    bot.callbackQuery(/^guide_type:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const type = ctx.callbackQuery.data.split(':')[1];
      ctx.session.adminWizard = { type };
      ctx.session.adminStep = 'guide_content';
      await ctx.reply(type === 'text' ? 'Matnni kiriting:' : 'Video file_id kiriting:');
    });

    bot.callbackQuery(/^admin_del_guide:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const id = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      await this.guideRepo.delete(id);
      await ctx.reply("✅ Element o'chirildi.");
    });

    bot.callbackQuery(/^admin_toggle_guide:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const id = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      const item = await this.guideRepo.findById(id);
      if (!item) return;
      await this.guideRepo.update(id, { is_active: !item.is_active });
      await ctx.reply(`✅ Element ${!item.is_active ? 'faollashtirildi' : 'o\'chirildi'}.`);
    });

    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();
      if (ctx.session.adminStep !== 'guide_content') return next();

      const wizard = ctx.session.adminWizard ?? {};
      const count = await this.guideRepo.count();

      await this.guideRepo.create({
        content_type: wizard.type as 'text' | 'video',
        body_text: wizard.type === 'text' ? ctx.message.text : null,
        media_file_id: wizard.type === 'video' ? ctx.message.text : null,
        sort_order: count + 1,
        is_active: true,
      });

      ctx.session.adminStep = undefined;
      ctx.session.adminWizard = {};
      await ctx.reply("✅ Qo'llanma elementi qo'shildi!");
      return;
    });
  }

  private async listGuideItems(ctx: any) {
    const items = await this.guideRepo.findAll();
    const kb = new InlineKeyboard();

    let text = "📖 <b>Qo'llanma elementlari</b>\n\n";
    for (const item of items) {
      const statusIcon = item.is_active ? '✅' : '⏸';
      const typeIcon = item.content_type === 'text' ? '📝' : '🎥';
      const preview = (item.body_text ?? item.media_file_id ?? '').slice(0, 40);
      text += `${statusIcon} ${typeIcon} ${preview}\n`;
      kb.text(`${item.is_active ? '⏸' : '▶️'}`, `admin_toggle_guide:${item.id}`)
        .text('🗑', `admin_del_guide:${item.id}`)
        .row();
    }

    kb.text("➕ Element qo'shish", 'admin_add_guide');

    await ctx.reply(text || "📭 Qo'llanma bo'sh.", { parse_mode: 'HTML', reply_markup: kb });
  }
}
