import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { SectionRepository } from '@/repositories/section.repository';
import { TopicRepository } from '@/repositories/topic.repository';
import { CB, cbData, parseCb } from '@/common/constants/callbacks';
import { RegistrationState } from '@/common/constants/registration-states';

@Injectable()
export class NavigationHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly sectionRepo: SectionRepository,
    private readonly topicRepo: TopicRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // "📚 Test ishlash" button → show root sections
    bot.hears('📚 Test ishlash', async (ctx) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) return;

      await this.showRootSections(ctx);
    });

    // Section drill-down
    bot.callbackQuery(new RegExp(`^${CB.SECTION}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const { params } = parseCb(ctx.callbackQuery.data);
      const sectionId = parseInt(params[0], 10);
      await this.showSectionContents(ctx, sectionId);
    });

    // Topic selected → show topic info + start button
    bot.callbackQuery(new RegExp(`^${CB.TOPIC}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const { params } = parseCb(ctx.callbackQuery.data);
      const topicId = parseInt(params[0], 10);
      await this.showTopicInfo(ctx, topicId);
    });

    // Back to root sections
    bot.callbackQuery(CB.BACK_SECTIONS, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showRootSections(ctx);
    });

    // Back to topics of parent section
    bot.callbackQuery(new RegExp(`^${CB.BACK_TOPICS}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const { params } = parseCb(ctx.callbackQuery.data);
      const sectionId = parseInt(params[0], 10);
      await this.showSectionContents(ctx, sectionId);
    });
  }

  private async showRootSections(ctx: any) {
    const user = ctx.dbUser;
    if (!user) return;

    const sections = await this.sectionRepo.findRoots();
    if (sections.length === 0) {
      await ctx.reply('📭 Hozircha bo\'limlar mavjud emas.');
      return;
    }

    const unlockedIds = await this.sectionRepo.getUserUnlockedIds(user.id);
    const unlockedSet = new Set(unlockedIds);

    const kb = new InlineKeyboard();
    for (const sec of sections) {
      const isLocked = sec.is_locked_by_default && !unlockedSet.has(sec.id);
      const label = isLocked ? `🔒 ${sec.title}` : sec.title;
      kb.text(label, cbData(CB.SECTION, sec.id)).row();
    }

    await ctx.reply('📚 <b>Bo\'limlar:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  }

  private async showSectionContents(ctx: any, sectionId: number) {
    const user = ctx.dbUser;
    if (!user) return;

    const section = await this.sectionRepo.findById(sectionId);
    if (!section || section.is_deleted) {
      await ctx.reply('Bo\'lim topilmadi.');
      return;
    }

    // Check lock
    if (section.is_locked_by_default) {
      const unlocked = await this.sectionRepo.isUnlockedByUser(user.id, sectionId);
      if (!unlocked) {
        let lockMsg = '🔒 Bu bo\'lim qulflangan.';
        if (section.unlock_required_section) {
          const req = await this.sectionRepo.findById(section.unlock_required_section);
          if (req) lockMsg += `\n\n<b>${req.title}</b> bo'limini yakunlang.`;
        }
        await ctx.reply(lockMsg, { parse_mode: 'HTML' });
        return;
      }
    }

    // Show sub-sections
    const children = await this.sectionRepo.findChildren(sectionId);
    // Show topics
    const topics = await this.topicRepo.findBySection(sectionId);

    const unlockedTopicIds = await this.topicRepo.getUserUnlockedIds(user.id);
    const unlockedTopicSet = new Set(unlockedTopicIds);

    const kb = new InlineKeyboard();

    // Sub-sections first
    for (const child of children) {
      kb.text(`📁 ${child.title}`, cbData(CB.SECTION, child.id)).row();
    }

    // Topics
    for (const topic of topics) {
      const isLocked = topic.is_locked_by_default && !unlockedTopicSet.has(topic.id);
      const qCount = await this.topicRepo.countQuestions(topic.id);
      const label = isLocked
        ? `🔒 ${topic.title}`
        : `📝 ${topic.title} (${qCount} savol)`;
      kb.text(label, cbData(CB.TOPIC, topic.id)).row();
    }

    kb.text('⬅️ Ortga', CB.BACK_SECTIONS);

    await ctx.reply(`📂 <b>${section.title}</b>`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  }

  private async showTopicInfo(ctx: any, topicId: number) {
    const user = ctx.dbUser;
    if (!user) return;

    const topic = await this.topicRepo.findById(topicId);
    if (!topic || topic.is_deleted) {
      await ctx.reply('Mavzu topilmadi.');
      return;
    }

    // Check topic lock
    if (topic.is_locked_by_default) {
      const unlocked = await this.topicRepo.isUnlockedByUser(user.id, topicId);
      if (!unlocked) {
        let msg = '🔒 Bu mavzu qulflangan.';
        if (topic.unlock_required_topic) {
          const req = await this.topicRepo.findById(topic.unlock_required_topic);
          if (req) msg += `\n\n<b>${req.title}</b> mavzusini yakunlang.`;
        }
        await ctx.reply(msg, { parse_mode: 'HTML' });
        return;
      }
    }

    const qCount = await this.topicRepo.countQuestions(topicId);

    if (qCount === 0) {
      await ctx.reply(`📝 <b>${topic.title}</b>\n\n⚠️ Bu mavzuda hali savollar yo'q.`, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('⬅️ Ortga', cbData(CB.BACK_TOPICS, topic.section_id)),
      });
      return;
    }

    const kb = new InlineKeyboard()
      .text('▶️ Testni boshlash', cbData(CB.START_TEST, topicId))
      .row()
      .text('⬅️ Ortga', cbData(CB.BACK_TOPICS, topic.section_id));

    await ctx.reply(
      `📝 <b>${topic.title}</b>\n\n` +
        `📊 Savollar: ${qCount}\n` +
        `⏱ Savol vaqti: ${topic.time_per_question_sec} soniya\n` +
        `🎯 Variantlar: ${topic.options_count} ta\n` +
        `🔄 Kunlik urinish: ${topic.daily_attempt_limit} ta`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
  }
}
