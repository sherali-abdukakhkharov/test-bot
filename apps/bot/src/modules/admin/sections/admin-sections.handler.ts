import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { SectionRepository } from '@/repositories/section.repository';

@Injectable()
export class AdminSectionsHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly sectionRepo: SectionRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // /sections command (admin only)
    bot.command('sections', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listSections(ctx);
    });

    bot.hears("📂 Bo'limlar", async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listSections(ctx);
    });

    bot.callbackQuery('admin_sections_list', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      await this.listSections(ctx);
    });

    bot.callbackQuery('admin_add_section', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      ctx.session.adminStep = 'add_section_title';
      ctx.session.adminWizard = {};
      await ctx.reply('Yangi bo\'lim nomini kiriting:');
    });

    bot.callbackQuery(/^admin_del_sec:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const id = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      await this.sectionRepo.softDelete(id);
      await ctx.reply(`✅ Bo'lim o'chirildi.`);
    });

    // Handle wizard text input for sections
    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();

      if (ctx.session.adminStep === 'add_section_title') {
        ctx.session.adminWizard = { title: ctx.message.text.trim() };
        ctx.session.adminStep = 'add_section_sort';
        await ctx.reply('Tartib raqamini kiriting (masalan: 1):');
        return;
      }

      if (ctx.session.adminStep === 'add_section_sort') {
        const sortOrder = parseInt(ctx.message.text.trim(), 10);
        const wizard = ctx.session.adminWizard ?? {};
        if (isNaN(sortOrder)) {
          await ctx.reply('Iltimos, raqam kiriting.');
          return;
        }
        await this.sectionRepo.create({
          parent_id: null,
          title: wizard.title as string,
          description: null,
          sort_order: sortOrder,
          is_locked_by_default: false,
          unlock_required_section: null,
          is_deleted: false,
        });
        ctx.session.adminStep = undefined;
        ctx.session.adminWizard = {};
        await ctx.reply(`✅ Bo'lim "<b>${wizard.title}</b>" qo'shildi!`, { parse_mode: 'HTML' });
        return;
      }

      return next();
    });
  }

  private async listSections(ctx: any) {
    const sections = await this.sectionRepo.findAll(false);
    if (sections.length === 0) {
      const kb = new InlineKeyboard().text("➕ Bo'lim qo'shish", 'admin_add_section');
      await ctx.reply("📂 Bo'limlar yo'q.", { reply_markup: kb });
      return;
    }

    let text = "📂 <b>Bo'limlar:</b>\n\n";
    const kb = new InlineKeyboard();
    for (const sec of sections) {
      text += `• [${sec.id}] ${sec.title} (tartib: ${sec.sort_order})\n`;
      kb.text(`🗑 ${sec.title}`, `admin_del_sec:${sec.id}`).row();
    }
    kb.text("➕ Bo'lim qo'shish", 'admin_add_section');

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
