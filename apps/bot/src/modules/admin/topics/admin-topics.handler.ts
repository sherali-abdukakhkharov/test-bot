import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { TopicRepository } from '@/repositories/topic.repository';
import { SectionRepository } from '@/repositories/section.repository';

@Injectable()
export class AdminTopicsHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly topicRepo: TopicRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.command('topics', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.listTopics(ctx);
    });

    bot.callbackQuery('admin_topics_list', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      await this.listTopics(ctx);
    });

    bot.callbackQuery('admin_add_topic', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      ctx.session.adminStep = 'add_topic_section';
      ctx.session.adminWizard = {};
      // Show section picker
      const sections = await this.sectionRepo.findAll(false);
      const kb = new InlineKeyboard();
      for (const sec of sections) {
        kb.text(sec.title, `pick_sec_for_topic:${sec.id}`).row();
      }
      await ctx.reply('Mavzu qaysi bo\'limga tegishli?', { reply_markup: kb });
    });

    bot.callbackQuery(/^pick_sec_for_topic:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const sectionId = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      ctx.session.adminWizard = { section_id: sectionId };
      ctx.session.adminStep = 'add_topic_title';
      await ctx.reply('Mavzu nomini kiriting:');
    });

    bot.callbackQuery(/^admin_del_topic:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const id = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      await this.topicRepo.softDelete(id);
      await ctx.reply(`✅ Mavzu o'chirildi.`);
    });

    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();

      if (ctx.session.adminStep === 'add_topic_title') {
        ctx.session.adminWizard = { ...(ctx.session.adminWizard ?? {}), title: ctx.message.text.trim() };
        ctx.session.adminStep = 'add_topic_sort';
        await ctx.reply('Tartib raqamini kiriting:');
        return;
      }

      if (ctx.session.adminStep === 'add_topic_sort') {
        const sortOrder = parseInt(ctx.message.text.trim(), 10);
        const wizard = ctx.session.adminWizard ?? {};
        if (isNaN(sortOrder)) {
          await ctx.reply('Raqam kiriting.');
          return;
        }
        await this.topicRepo.create({
          section_id: wizard.section_id as number,
          title: wizard.title as string,
          sort_order: sortOrder,
          time_per_question_sec: 30,
          options_count: 4,
          daily_attempt_limit: 3,
          is_locked_by_default: false,
          unlock_required_topic: null,
          is_deleted: false,
        });
        ctx.session.adminStep = undefined;
        ctx.session.adminWizard = {};
        await ctx.reply(`✅ Mavzu "<b>${wizard.title}</b>" qo'shildi!`, { parse_mode: 'HTML' });
        return;
      }

      return next();
    });
  }

  private async listTopics(ctx: any) {
    const topics = await this.topicRepo.findAll(false);
    if (topics.length === 0) {
      await ctx.reply("📝 Mavzular yo'q.", {
        reply_markup: new InlineKeyboard().text("➕ Mavzu qo'shish", 'admin_add_topic'),
      });
      return;
    }

    let text = '📝 <b>Mavzular:</b>\n\n';
    const kb = new InlineKeyboard();
    for (const t of topics) {
      const qc = await this.topicRepo.countQuestions(t.id);
      text += `• [${t.id}] ${t.title} — ${qc} savol\n`;
      kb.text(`🗑 ${t.title}`, `admin_del_topic:${t.id}`).row();
    }
    kb.text("➕ Mavzu qo'shish", 'admin_add_topic');

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
