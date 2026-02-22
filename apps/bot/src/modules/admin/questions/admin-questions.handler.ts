import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { QuestionRepository } from '@/repositories/question.repository';
import { TopicRepository } from '@/repositories/topic.repository';
import Papa from 'papaparse';

@Injectable()
export class AdminQuestionsHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly questionRepo: QuestionRepository,
    private readonly topicRepo: TopicRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears('📝 Savollar', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showTopicPicker(ctx);
    });

    bot.command('questions', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showTopicPicker(ctx);
    });

    // Topic selected for question management
    bot.callbackQuery(/^admin_q_topic:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const topicId = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      ctx.session.adminWizard = { topicId };
      await this.listQuestions(ctx, topicId);
    });

    // Add question
    bot.callbackQuery(/^admin_add_q:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const topicId = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      ctx.session.adminStep = 'add_q_body';
      ctx.session.adminWizard = { topicId, options: [] };
      await ctx.reply(
        'Savol matnini kiriting (yoki /skip - agar faqat media bo\'lsa):',
      );
    });

    // Delete question
    bot.callbackQuery(/^admin_del_q:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.dbAdmin) return;
      const id = parseInt(ctx.callbackQuery.data.split(':')[1], 10);
      await this.questionRepo.softDelete(id);
      await ctx.reply("✅ Savol o'chirildi.");
    });

    // Handle CSV/document upload for bulk import
    bot.on('message:document', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();
      if (ctx.session.adminStep !== 'awaiting_csv') return next();

      const doc = ctx.message.document;
      if (!doc.mime_type?.includes('csv') && !doc.file_name?.endsWith('.csv')) {
        await ctx.reply('Faqat CSV fayl qabul qilinadi.');
        return;
      }

      const wizard = ctx.session.adminWizard ?? {};
      const topicId = wizard.topicId as number;
      const topic = await this.topicRepo.findById(topicId);
      if (!topic) return;

      try {
        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        const response = await fetch(url);
        const csvText = await response.text();

        const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
        const rows = parsed.data.slice(1); // skip header

        let imported = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const questionText = row[0]?.trim();
          if (!questionText) {
            errors.push(`Qator ${i + 2}: Savol matni bo'sh`);
            continue;
          }

          const options: Array<{ body_text: string; is_correct: boolean; sort_order: number }> = [];
          let hasCorrect = false;

          for (let j = 1; j <= topic.options_count; j++) {
            const optText = row[j]?.trim();
            const isCorrect = row[topic.options_count + j]?.trim() === '1';
            if (!optText) {
              errors.push(`Qator ${i + 2}: Variant ${j} bo'sh`);
              break;
            }
            if (isCorrect) hasCorrect = true;
            options.push({ body_text: optText, is_correct: isCorrect, sort_order: j });
          }

          if (!hasCorrect) {
            errors.push(`Qator ${i + 2}: To'g'ri javob belgilanmagan`);
            continue;
          }

          if (options.length < topic.options_count) continue;

          await this.questionRepo.create(
            {
              topic_id: topicId,
              body_text: questionText,
              media_type: null,
              media_file_id: null,
              sort_order: imported + 1,
              is_deleted: false,
            },
            options,
          );
          imported++;
        }

        ctx.session.adminStep = undefined;
        let resultMsg = `✅ <b>${imported}</b> ta savol yuklandi.`;
        if (errors.length) {
          resultMsg += `\n⚠️ <b>${errors.length}</b> ta xato:\n` + errors.slice(0, 5).join('\n');
        }
        await ctx.reply(resultMsg, { parse_mode: 'HTML' });
      } catch (e) {
        await ctx.reply('❌ Faylni qayta ishlashda xato yuz berdi.');
      }
    });

    // Wizard text input
    bot.on('message:text', async (ctx, next) => {
      if (!ctx.dbAdmin) return next();
      const step = ctx.session.adminStep;
      const wizard = ctx.session.adminWizard ?? {};

      if (step === 'add_q_body') {
        const text = ctx.message.text === '/skip' ? null : ctx.message.text.trim();
        ctx.session.adminWizard = { ...wizard, bodyText: text };
        ctx.session.adminStep = 'add_q_options';

        const topic = await this.topicRepo.findById(wizard.topicId as number);
        ctx.session.adminWizard = { ...ctx.session.adminWizard, optionsCount: topic?.options_count ?? 4, currentOption: 0, options: [] };
        await ctx.reply(`1-variantni kiriting:`);
        return;
      }

      if (step === 'add_q_options') {
        const opts = (wizard.options as any[]) ?? [];
        opts.push(ctx.message.text.trim());
        const optionsCount = wizard.optionsCount as number ?? 4;

        if (opts.length < optionsCount) {
          ctx.session.adminWizard = { ...wizard, options: opts };
          await ctx.reply(`${opts.length + 1}-variantni kiriting:`);
          return;
        }

        // All options collected — ask correct answer index
        ctx.session.adminWizard = { ...wizard, options: opts };
        ctx.session.adminStep = 'add_q_correct';
        let msg = 'To\'g\'ri javobni tanlang:\n\n';
        opts.forEach((o: string, i: number) => { msg += `${i + 1}. ${o}\n`; });
        msg += '\nRaqamini kiriting (1, 2, 3 yoki 4):';
        await ctx.reply(msg);
        return;
      }

      if (step === 'add_q_correct') {
        const correctIdx = parseInt(ctx.message.text.trim(), 10) - 1;
        const opts = (wizard.options as string[]) ?? [];
        if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= opts.length) {
          await ctx.reply('Noto\'g\'ri raqam. Qayta kiriting:');
          return;
        }

        const options = opts.map((o, i) => ({
          body_text: o,
          is_correct: i === correctIdx,
          sort_order: i + 1,
        }));

        await this.questionRepo.create(
          {
            topic_id: wizard.topicId as number,
            body_text: wizard.bodyText as string | null,
            media_type: null,
            media_file_id: null,
            sort_order: 0,
            is_deleted: false,
          },
          options,
        );

        ctx.session.adminStep = undefined;
        ctx.session.adminWizard = {};
        await ctx.reply(`✅ Savol qo'shildi!`);
        return;
      }

      return next();
    });
  }

  private async showTopicPicker(ctx: any) {
    const topics = await this.topicRepo.findAll(false);
    if (topics.length === 0) {
      await ctx.reply('Avval mavzu qo\'shing.');
      return;
    }
    const kb = new InlineKeyboard();
    for (const t of topics) {
      kb.text(t.title, `admin_q_topic:${t.id}`).row();
    }
    await ctx.reply('📝 Qaysi mavzu savollarini boshqarmoqchisiz?', { reply_markup: kb });
  }

  private async listQuestions(ctx: any, topicId: number) {
    const topic = await this.topicRepo.findById(topicId);
    const questions = await this.questionRepo.findByTopic(topicId);

    let text = `📝 <b>${topic?.title ?? 'Mavzu'}</b> savollari:\n\n`;
    const kb = new InlineKeyboard();

    if (questions.length === 0) {
      text += 'Savollar yo\'q.';
    } else {
      questions.slice(0, 20).forEach((q, i) => {
        text += `${i + 1}. ${(q.body_text ?? '[Media]').slice(0, 80)}\n`;
        kb.text(`🗑 ${i + 1}`, `admin_del_q:${q.id}`);
        if ((i + 1) % 4 === 0) kb.row();
      });
      kb.row();
    }

    kb.text('➕ Savol qo\'shish', `admin_add_q:${topicId}`)
      .text('📥 CSV yuklash', `admin_csv:${topicId}`);

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
