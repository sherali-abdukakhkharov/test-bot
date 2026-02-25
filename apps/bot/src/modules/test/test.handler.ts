import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { TopicRepository } from '@/repositories/topic.repository';
import { QuestionRepository, QuestionWithOptions } from '@/repositories/question.repository';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import { SectionRepository } from '@/repositories/section.repository';
import { CB, cbData, parseCb } from '@/common/constants/callbacks';
import { formatScore } from '@/common/utils/format';

const QUESTIONS_PER_SESSION = 10;

@Injectable()
export class TestHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly topicRepo: TopicRepository,
    private readonly questionRepo: QuestionRepository,
    private readonly sessionRepo: TestSessionRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // Start test
    bot.callbackQuery(new RegExp(`^${CB.START_TEST}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser;
      if (!user) return;

      const { params } = parseCb(ctx.callbackQuery.data);
      const topicId = parseInt(params[0], 10);

      const topic = await this.topicRepo.findById(topicId);
      if (!topic) return;

      // Check daily limit
      const todayCount = await this.sessionRepo.countTodayAttempts(user.id, topicId);
      if (todayCount >= topic.daily_attempt_limit) {
        await ctx.reply(
          `⛔ Bugun bu mavzu uchun urinishlar limitiga yetdingiz (${topic.daily_attempt_limit} ta).\n` +
            `Ertaga qayta urinib ko'ring.`,
        );
        return;
      }

      // Abandon any active session
      const activeSession = await this.sessionRepo.findActiveByUser(user.id);
      if (activeSession) {
        await this.sessionRepo.abandon(activeSession.id);
      }

      // Load random questions
      const questions = await this.questionRepo.findRandomForSession(topicId, QUESTIONS_PER_SESSION);
      if (questions.length === 0) {
        await ctx.reply('❌ Bu mavzuda savollar topilmadi.');
        return;
      }

      // Create session
      const dbSession = await this.sessionRepo.create(user.id, topicId, questions.length);
      await this.sessionRepo.incrementDailyCount(user.id, topicId);

      // Store question IDs in session
      ctx.session.activeTestSessionId = String(dbSession.id);
      ctx.session.questionIndex = 0;
      ctx.session.questionIds = questions.map((q) => q.id);

      await ctx.reply(
        `🚀 <b>${topic.title}</b> testi boshlandi!\n\n` +
          `📊 Savollar: ${questions.length} ta\n` +
          `⏱ Har savol uchun: ${topic.time_per_question_sec} soniya\n\n` +
          `Tayyor bo'lsangiz, birinchi savolga o'ting.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text("▶️ Boshlash", 'test_next'),
        },
      );
    });

    // Show next question
    bot.callbackQuery('test_next', async (ctx) => {
      await ctx.answerCallbackQuery();
      // Delete the triggering message (start prompt or answer feedback) so it
      // cannot be pressed a second time and does not linger in the chat.
      try { await ctx.deleteMessage(); } catch { /* already deleted */ }
      await this.sendCurrentQuestion(ctx);
    });

    // Answer selected
    bot.callbackQuery(new RegExp(`^${CB.ANSWER}:`), async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser;
      if (!user) return;

      const sessionId = ctx.session.activeTestSessionId;
      if (!sessionId) {
        await ctx.reply('❌ Faol test topilmadi. /start buyrug\'ini yuboring.');
        return;
      }

      const { params } = parseCb(ctx.callbackQuery.data);
      const questionId = parseInt(params[0], 10);
      const chosenOptionId = parseInt(params[1], 10);

      // Guard: if this question was already answered (e.g. rapid double-tap),
      // do nothing — the message was already edited to show the nav button.
      if (await this.sessionRepo.hasAnswer(BigInt(sessionId), questionId)) return;

      const questionWithOpts = await this.questionRepo.findWithOptions(questionId);
      if (!questionWithOpts) {
        await ctx.reply('❌ Savol topilmadi.');
        return;
      }

      // Use Number() to handle PostgreSQL returning integer PKs as strings
      const chosenOpt = questionWithOpts.options.find((o) => Number(o.id) === chosenOptionId);
      const correctOpt = questionWithOpts.options.find((o) => o.is_correct);

      if (!chosenOpt) {
        await ctx.reply('❌ Variant topilmadi.');
        return;
      }
      if (!correctOpt) {
        await ctx.reply('❌ To\'g\'ri javob belgilanmagan. Admin bilan bog\'laning.');
        return;
      }

      // Record answer
      await this.sessionRepo.recordAnswer({
        session_id: BigInt(sessionId),
        question_id: questionId,
        question_snapshot: questionWithOpts.body_text ?? '',
        chosen_option_id: chosenOptionId,
        chosen_option_text: chosenOpt.body_text,
        correct_option_text: correctOpt.body_text,
        is_correct: chosenOpt.is_correct,
      });

      const feedback = chosenOpt.is_correct
        ? '✅ <b>To\'g\'ri!</b>'
        : `❌ <b>Noto\'g\'ri!</b>\n\nTo\'g\'ri javob: <b>${correctOpt.body_text}</b>`;

      // Move to next question
      const currentIndex = ctx.session.questionIndex ?? 0;
      const questionIds = ctx.session.questionIds ?? [];
      ctx.session.questionIndex = currentIndex + 1;

      const isLast = ctx.session.questionIndex >= questionIds.length;

      // Edit the options message to show feedback + navigation button
      await ctx.editMessageText(
        `${ctx.callbackQuery.message?.text ?? ''}\n\n${feedback}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(
            isLast ? '🏁 Natijani ko\'rish' : '➡️ Keyingi savol',
            isLast ? `${CB.FINISH_TEST}` : 'test_next',
          ),
        },
      );
    });

    // Finish test
    bot.callbackQuery(CB.FINISH_TEST, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser;
      if (!user) return;

      const sessionId = ctx.session.activeTestSessionId;
      if (!sessionId) return;

      const answers = await this.sessionRepo.getAnswers(BigInt(sessionId));
      const correctCount = answers.filter((a) => a.is_correct).length;
      const total = answers.length;

      await this.sessionRepo.complete(BigInt(sessionId), correctCount, total);

      // Unlock section/topic if score ≥ 70%
      const score = total > 0 ? (correctCount / total) * 100 : 0;
      const session = await this.sessionRepo.findById(BigInt(sessionId));

      if (session && score >= 70) {
        await this.topicRepo.unlockForUser(user.id, session.topic_id);
        const topic = await this.topicRepo.findById(session.topic_id);
        if (topic) {
          await this.unlockSectionIfNeeded(user.id, topic.section_id);
        }
      }

      // Clear session
      ctx.session.activeTestSessionId = undefined;
      ctx.session.questionIndex = undefined;
      ctx.session.questionIds = undefined;

      // Remove the "🏁 Natijani ko'rish" button message so it can't be re-pressed.
      try { await ctx.deleteMessage(); } catch { /* already deleted */ }

      const emoji = score >= 90 ? '🏆' : score >= 70 ? '🎉' : score >= 50 ? '😊' : '😔';

      await ctx.reply(
        `${emoji} <b>Test yakunlandi!</b>\n\n` +
          `✅ To\'g\'ri: ${correctCount} / ${total}\n` +
          `📊 Natija: ${formatScore(correctCount, total)}\n\n` +
          (score >= 70 ? '🔓 Mavzu qulfi ochildi!' : 'Qayta urinib ko\'ring!'),
        { parse_mode: 'HTML' },
      );
    });
  }

  private async sendCurrentQuestion(ctx: any) {
    const questionIds = ctx.session.questionIds ?? [];
    const index = ctx.session.questionIndex ?? 0;

    if (index >= questionIds.length) {
      await ctx.reply('Test yakunlandi.');
      return;
    }

    const questionId = questionIds[index];
    const question = await this.questionRepo.findWithOptions(questionId);
    if (!question) {
      await ctx.reply('Savol topilmadi.');
      return;
    }

    // Shuffle options randomly for this display
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const shuffled = [...question.options].sort(() => Math.random() - 0.5);
    const letters = LETTERS.slice(0, shuffled.length);

    const questionHeader = `📌 <b>Savol ${index + 1}/${questionIds.length}</b>`;
    const questionBody = question.body_text ?? '(Media savol)';

    // Build options text and letter keyboard
    const optionsText = shuffled.map((opt, i) => `(${letters[i]}) ${opt.body_text}`).join('\n');

    const kb = new InlineKeyboard();
    shuffled.forEach((opt, i) => {
      kb.text(letters[i], cbData(CB.ANSWER, question.id, opt.id));
    });

    // Combined message: question + blank line + options, with keyboard attached
    const fullText = `${questionHeader}\n\n${questionBody}\n\n${optionsText}`;

    if (question.media_file_id && question.media_type) {
      // For media questions: send media first (caption = question only, no options — caption limit 1024),
      // then send the options+keyboard as a text message
      const caption = `${questionHeader}\n\n${questionBody}`;
      if (question.media_type === 'image') {
        await ctx.replyWithPhoto(question.media_file_id, { caption, parse_mode: 'HTML' });
      } else if (question.media_type === 'audio') {
        await ctx.replyWithAudio(question.media_file_id, { caption, parse_mode: 'HTML' });
      } else if (question.media_type === 'video') {
        await ctx.replyWithVideo(question.media_file_id, { caption, parse_mode: 'HTML' });
      }
      await ctx.reply(optionsText, { reply_markup: kb });
    } else {
      // Text-only question: one message with question + options + keyboard
      await ctx.reply(fullText, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  // Unlock the section for the user (on passing score)
  private async unlockSectionIfNeeded(userId: bigint, sectionId: number): Promise<void> {
    await this.sectionRepo.unlockForUser(userId, sectionId);
  }
}
