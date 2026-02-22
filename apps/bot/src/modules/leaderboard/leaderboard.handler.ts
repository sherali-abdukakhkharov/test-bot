import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import { UserRepository } from '@/repositories/user.repository';
import { RegistrationState } from '@/common/constants/registration-states';
import { displayName, formatScore } from '@/common/utils/format';
import { formatDateTime } from '@/common/utils/tashkent-date';
import { TopicRepository } from '@/repositories/topic.repository';

@Injectable()
export class LeaderboardHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly sessionRepo: TestSessionRepository,
    private readonly userRepo: UserRepository,
    private readonly topicRepo: TopicRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // "📊 Natijalar" button — show user's own results + top 10 leaderboard
    bot.hears('📊 Natijalar', async (ctx) => {
      const user = ctx.dbUser;
      if (!user || user.registration_state !== RegistrationState.REGISTERED) return;

      // User's recent sessions
      const history = await this.sessionRepo.getUserHistory(user.id, 10);

      let myResults = `📊 <b>Mening natijalarim</b>\n\n`;
      if (history.length === 0) {
        myResults += 'Hali birorta test topshirmagansiz.\n';
      } else {
        for (const s of history.slice(0, 5)) {
          const topic = await this.topicRepo.findById(s.topic_id);
          myResults +=
            `• <b>${topic?.title ?? 'Mavzu'}</b>: ${s.score_percent}%` +
            ` (${formatDateTime(s.finished_at ?? s.started_at)})\n`;
        }
      }

      await ctx.reply(myResults, { parse_mode: 'HTML' });

      // Top leaderboard
      const leaders = await this.sessionRepo.getLeaderboard(10);
      if (leaders.length === 0) return;

      let lbText = '🏆 <b>Top 10 reyting:</b>\n\n';
      let rank = 1;
      for (const entry of leaders) {
        const u = await this.userRepo.findByTelegramId(String(entry.user_id));
        const name = u ? displayName(u.first_name, u.last_name, u.username) : 'Noma\'lum';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        lbText += `${medal} ${name} — ${Number(entry.best_score).toFixed(0)}%\n`;
        rank++;
      }

      await ctx.reply(lbText, { parse_mode: 'HTML' });
    });
  }
}
