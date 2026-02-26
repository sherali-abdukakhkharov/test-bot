import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '@/bot/bot.service';
import { TopicRepository } from '@/repositories/topic.repository';
import { QuestionRepository } from '@/repositories/question.repository';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import { SectionRepository } from '@/repositories/section.repository';
import { CB, cbData, parseCb } from '@/common/constants/callbacks';
import { formatScore } from '@/common/utils/format';

const QUESTIONS_PER_SESSION = 10;
/** Seconds to show answer feedback before auto-advancing to next question */
const FEEDBACK_DELAY_SEC = 2;

interface TimerData {
  chatId: number;
  sessionId: string;
  questionIndex: number;
  questionIds: number[];
}

@Injectable()
export class TestHandler implements OnModuleInit {
  private readonly logger = new Logger(TestHandler.name);
  /** Active per-question expiry timers. Key: `${sessionId}-${questionIndex}` */
  private readonly questionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly botService: BotService,
    private readonly topicRepo: TopicRepository,
    private readonly questionRepo: QuestionRepository,
    private readonly sessionRepo: TestSessionRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  // ─── Timer Helpers ───────────────────────────────────────────────────────────

  private timerKey(sessionId: string, index: number) {
    return `${sessionId}-${index}`;
  }

  private clearTimer(sessionId: string, index: number) {
    const key = this.timerKey(sessionId, index);
    const t = this.questionTimers.get(key);
    this.logger.log(`[clearTimer] sid=${sessionId} index=${index} found=${!!t}`);
    if (t) { clearTimeout(t); this.questionTimers.delete(key); }
  }

  private clearAllTimers(sessionId: string, questionIds: number[]) {
    for (let i = 0; i < questionIds.length; i++) {
      this.clearTimer(sessionId, i);
    }
  }

  /**
   * Start the per-question timeout. If the user doesn't answer in time,
   * the next question is sent (or the test is finished) automatically.
   */
  private startExpiryTimer(data: TimerData, timeoutSec: number) {
    const key = this.timerKey(data.sessionId, data.questionIndex);
    this.clearTimer(data.sessionId, data.questionIndex);
    this.logger.log(`[expiryTimer] START sid=${data.sessionId} index=${data.questionIndex} timeout=${timeoutSec}s`);

    const t = setTimeout(async () => {
      this.questionTimers.delete(key);
      // Guard: user might have answered at the exact same instant
      const alreadyAnswered = await this.sessionRepo.hasAnswer(
        BigInt(data.sessionId),
        data.questionIds[data.questionIndex],
      );
      this.logger.log(`[expiryTimer] FIRED sid=${data.sessionId} index=${data.questionIndex} alreadyAnswered=${alreadyAnswered}`);
      if (alreadyAnswered) return;

      const bot = this.botService.bot;
      await bot.api.sendMessage(data.chatId, '⏰ <b>Vaqt tugadi!</b>', { parse_mode: 'HTML' }).catch(() => undefined);

      const nextIndex = data.questionIndex + 1;
      if (nextIndex >= data.questionIds.length) {
        await this.autoFinishTest(data.chatId, data.sessionId);
      } else {
        const session = await this.sessionRepo.findById(BigInt(data.sessionId));
        const topic = session ? await this.topicRepo.findById(session.topic_id) : null;
        await this.sendQuestionDirect(
          data.chatId,
          data.sessionId,
          nextIndex,
          data.questionIds,
          topic?.time_per_question_sec ?? 30,
        );
      }
    }, timeoutSec * 1000);

    this.questionTimers.set(key, t);
  }

  /**
   * After an answer is recorded, show feedback briefly then advance automatically.
   */
  private startFeedbackTimer(
    chatId: number,
    feedbackMessageId: number,
    sessionId: string,
    nextIndex: number,
    questionIds: number[],
  ) {
    this.logger.log(`[feedbackTimer] START sid=${sessionId} nextIndex=${nextIndex}`);
    setTimeout(async () => {
      this.logger.log(`[feedbackTimer] FIRED sid=${sessionId} nextIndex=${nextIndex}`);
      const bot = this.botService.bot;
      await bot.api.deleteMessage(chatId, feedbackMessageId).catch(() => undefined);

      if (nextIndex >= questionIds.length) {
        await this.autoFinishTest(chatId, sessionId);
      } else {
        const session = await this.sessionRepo.findById(BigInt(sessionId));
        const topic = session ? await this.topicRepo.findById(session.topic_id) : null;
        await this.sendQuestionDirect(
          chatId,
          sessionId,
          nextIndex,
          questionIds,
          topic?.time_per_question_sec ?? 30,
        );
      }
    }, FEEDBACK_DELAY_SEC * 1000);
  }

  /**
   * Send a question using bot.api directly — works inside timer callbacks
   * where no grammY ctx is available.
   */
  private async sendQuestionDirect(
    chatId: number,
    sessionId: string,
    index: number,
    questionIds: number[],
    timeoutSec: number,
  ) {
    if (index >= questionIds.length) return;

    const questionId = questionIds[index];
    this.logger.log(`[sendQ] sid=${sessionId} index=${index}/${questionIds.length} questionId=${questionId}`);
    const question = await this.questionRepo.findWithOptions(questionId);
    if (!question) return;

    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const shuffled = [...question.options].sort(() => Math.random() - 0.5);
    const letters = LETTERS.slice(0, shuffled.length);

    const questionHeader = `📌 <b>Savol ${index + 1}/${questionIds.length}</b>`;
    const questionBody = question.body_text ?? '(Media savol)';
    const optionsText = shuffled.map((opt, i) => `(${letters[i]}) ${opt.body_text}`).join('\n');

    const kb = new InlineKeyboard();
    shuffled.forEach((opt, i) => {
      // Encode question index so the ANSWER handler doesn't need indexOf on session data
      kb.text(letters[i], cbData(CB.ANSWER, index, question.id, opt.id));
    });

    const bot = this.botService.bot;

    if (question.media_file_id && question.media_type) {
      const caption = `${questionHeader}\n\n${questionBody}`;
      if (question.media_type === 'image') {
        await bot.api.sendPhoto(chatId, question.media_file_id, { caption, parse_mode: 'HTML' }).catch(() => undefined);
      } else if (question.media_type === 'audio') {
        await bot.api.sendAudio(chatId, question.media_file_id, { caption, parse_mode: 'HTML' }).catch(() => undefined);
      } else if (question.media_type === 'video') {
        await bot.api.sendVideo(chatId, question.media_file_id, { caption, parse_mode: 'HTML' }).catch(() => undefined);
      }
      await bot.api.sendMessage(chatId, optionsText, { reply_markup: kb });
    } else {
      await bot.api.sendMessage(
        chatId,
        `${questionHeader}\n\n${questionBody}\n\n${optionsText}`,
        { parse_mode: 'HTML', reply_markup: kb },
      );
    }

    // Start the per-question countdown
    this.startExpiryTimer({ chatId, sessionId, questionIndex: index, questionIds }, timeoutSec);
  }

  /** Finish the test from a timer callback (no grammY ctx). */
  private async autoFinishTest(chatId: number, sessionId: string) {
    const bot = this.botService.bot;

    const answers = await this.sessionRepo.getAnswers(BigInt(sessionId));
    const correctCount = answers.filter((a) => a.is_correct).length;
    const total = answers.length;
    const score = total > 0 ? (correctCount / total) * 100 : 0;
    this.logger.log(`[autoFinish] sid=${sessionId} correct=${correctCount}/${total} score=${score.toFixed(1)}%`);

    await this.sessionRepo.complete(BigInt(sessionId), correctCount, total);

    const session = await this.sessionRepo.findById(BigInt(sessionId));

    if (session && score >= 90) {
      await this.topicRepo.unlockForUser(session.user_id, session.topic_id);
      const topic = await this.topicRepo.findById(session.topic_id);
      if (topic) {
        await this.sectionRepo.unlockForUser(session.user_id, topic.section_id);
      }
    }

    const emoji = score >= 90 ? '🏆' : score >= 70 ? '🎉' : score >= 50 ? '😊' : '😔';
    await bot.api.sendMessage(
      chatId,
      `${emoji} <b>Test yakunlandi!</b>\n\n` +
        `✅ To'g'ri: ${correctCount} / ${total}\n` +
        `📊 Natija: ${formatScore(correctCount, total)}\n\n` +
        (score >= 90 ? '🔓 Mavzu qulfi ochildi!' : 'Qayta urinib ko\'ring!'),
      { parse_mode: 'HTML' },
    );
  }

  // ─── grammY Handlers ────────────────────────────────────────────────────────

  onModuleInit() {
    const bot = this.botService.bot;

    // ── Start test ─────────────────────────────────────────────────────────────
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

      // Abandon any active session + cancel its timers
      const activeSession = await this.sessionRepo.findActiveByUser(user.id);
      if (activeSession) {
        this.clearAllTimers(String(activeSession.id), ctx.session.questionIds ?? []);
        await this.sessionRepo.abandon(activeSession.id);
      }

      // Load random questions
      const questions = await this.questionRepo.findRandomForSession(topicId, QUESTIONS_PER_SESSION);
      if (questions.length === 0) {
        await ctx.reply('❌ Bu mavzuda savollar topilmadi.');
        return;
      }
      this.logger.log(`[START_TEST] userId=${user.id} topicId=${topicId} questionCount=${questions.length}`);

      // Create session
      const dbSession = await this.sessionRepo.create(user.id, topicId, questions.length);
      await this.sessionRepo.incrementDailyCount(user.id, topicId);

      // Store all needed data in session state
      ctx.session.activeTestSessionId = String(dbSession.id);
      ctx.session.questionIndex = 0;
      ctx.session.questionIds = questions.map((q) => Number(q.id));
      ctx.session.timePerQuestionSec = topic.time_per_question_sec;

      await ctx.reply(
        `🚀 <b>${topic.title}</b> testi boshlandi!\n\n` +
          `📊 Savollar: ${questions.length} ta\n` +
          `⏱ Har savol uchun: ${topic.time_per_question_sec} soniya\n\n` +
          `Tayyor bo'lsangiz, birinchi savolga o'ting.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('▶️ Boshlash', 'test_next'),
        },
      );
    });

    // ── Show first question ("▶️ Boshlash" button) ─────────────────────────────
    bot.callbackQuery('test_next', async (ctx) => {
      await ctx.answerCallbackQuery();
      try { await ctx.deleteMessage(); } catch { /* already deleted */ }

      const sessionId = ctx.session.activeTestSessionId;
      const questionIds = ctx.session.questionIds ?? [];
      const index = ctx.session.questionIndex ?? 0;
      const timeoutSec = ctx.session.timePerQuestionSec ?? 30;
      const chatId = ctx.chat?.id;
      if (!sessionId || !chatId) return;

      await this.sendQuestionDirect(chatId, sessionId, index, questionIds, timeoutSec);
    });

    // ── Answer selected ─────────────────────────────────────────────────────────
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
      // Callback format: ans:<questionIndex>:<questionId>:<optionId>
      // Index is embedded in callback data — no session lookup needed.
      const questionIndex = parseInt(params[0], 10);
      const questionId = parseInt(params[1], 10);
      const chosenOptionId = parseInt(params[2], 10);

      this.logger.log(`[ANSWER] sid=${sessionId} qIdx=${questionIndex} questionId=${questionId} optId=${chosenOptionId}`);

      // Guard: already answered (rapid tap or timer fired simultaneously)
      if (await this.sessionRepo.hasAnswer(BigInt(sessionId), questionId)) {
        this.logger.warn(`[ANSWER] already answered sid=${sessionId} questionId=${questionId}, skipping`);
        return;
      }

      // Stale-button guard: if session still has the question list, verify the index matches.
      // (Session may be absent if freeStorage fetch fails — in that case we trust the callback data.)
      const questionIds = ctx.session.questionIds ?? [];
      if (questionIds.length > 0 && Number(questionIds[questionIndex]) !== questionId) {
        this.logger.warn(`[ANSWER] stale button sid=${sessionId} qIdx=${questionIndex} expected=${Number(questionIds[questionIndex])} got=${questionId}`);
        return;
      }

      const questionWithOpts = await this.questionRepo.findWithOptions(questionId);
      if (!questionWithOpts) {
        await ctx.reply('❌ Savol topilmadi.');
        return;
      }

      const chosenOpt = questionWithOpts.options.find((o) => Number(o.id) === chosenOptionId);
      const correctOpt = questionWithOpts.options.find((o) => o.is_correct);

      if (!chosenOpt) { await ctx.reply('❌ Variant topilmadi.'); return; }
      if (!correctOpt) { await ctx.reply('❌ To\'g\'ri javob belgilanmagan. Admin bilan bog\'laning.'); return; }

      // Cancel THIS question's expiry timer using the index from the callback
      this.clearTimer(sessionId, questionIndex);

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
        : '❌ <b>Noto\'g\'ri!</b>';

      // Advance to the question after the one we just answered
      const nextIndex = questionIndex + 1;
      ctx.session.questionIndex = nextIndex;

      // Edit the message to show feedback (no navigation button — timer handles advance)
      await ctx.editMessageText(
        `${ctx.callbackQuery.message?.text ?? ''}\n\n${feedback}`,
        { parse_mode: 'HTML' },
      );

      const feedbackMessageId = ctx.callbackQuery.message?.message_id;
      const chatId = ctx.chat?.id;
      if (feedbackMessageId && chatId) {
        this.startFeedbackTimer(chatId, feedbackMessageId, sessionId, nextIndex, questionIds);
      }
    });
  }
}
