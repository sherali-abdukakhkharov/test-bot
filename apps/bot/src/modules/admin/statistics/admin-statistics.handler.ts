import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import { UserRepository } from '@/repositories/user.repository';
import { displayName } from '@/common/utils/format';
import ExcelJS from 'exceljs';

@Injectable()
export class AdminStatisticsHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly sessionRepo: TestSessionRepository,
    private readonly userRepo: UserRepository,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.hears('📊 Statistika', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showStats(ctx);
    });

    bot.command('stats', async (ctx) => {
      if (!ctx.dbAdmin) return;
      await this.showStats(ctx);
    });

    bot.callbackQuery('admin_export_stats', async (ctx) => {
      await ctx.answerCallbackQuery('Tayyorlanmoqda...');
      if (!ctx.dbAdmin) return;
      await this.exportExcel(ctx);
    });
  }

  private async showStats(ctx: any) {
    const [totalUsers, todayUsers, totalSessions, todaySessions] = await Promise.all([
      this.userRepo.countAll(),
      this.userRepo.countToday(),
      this.sessionRepo.countAllSessions(),
      this.sessionRepo.countTodaySessions(),
    ]);

    const leaders = await this.sessionRepo.getLeaderboard(3);
    let topText = '';
    for (let i = 0; i < leaders.length; i++) {
      const u = await this.userRepo.findByTelegramId(String(leaders[i].user_id));
      const name = u ? displayName(u.first_name, u.last_name, u.username) : 'Noma\'lum';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      topText += `${medal} ${name} — ${Number(leaders[i].best_score).toFixed(0)}%\n`;
    }

    const msg =
      `📊 <b>Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${totalUsers}</b>\n` +
      `🆕 Bugun qo'shilgan: <b>${todayUsers}</b>\n\n` +
      `📝 Jami testlar: <b>${totalSessions}</b>\n` +
      `📝 Bugungi testlar: <b>${todaySessions}</b>\n\n` +
      `🏆 Top 3:\n${topText || 'Ma\'lumot yo\'q'}`;

    const { InlineKeyboard } = await import('grammy');
    const kb = new InlineKeyboard().text('📥 Excel yuklab olish', 'admin_export_stats');

    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
  }

  private async exportExcel(ctx: any) {
    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Users
      const usersSheet = workbook.addWorksheet('Foydalanuvchilar');
      usersSheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Ism', key: 'name', width: 25 },
        { header: 'Telegram ID', key: 'tgId', width: 20 },
        { header: 'Qo\'shilgan sana', key: 'joinedAt', width: 20 },
        { header: 'Bloklangan', key: 'isBlocked', width: 15 },
      ];

      const { rows: allUsers } = await this.userRepo.findAll({ page: 1, limit: 10000 });
      for (const u of allUsers) {
        usersSheet.addRow({
          id: String(u.id),
          name: displayName(u.first_name, u.last_name, u.username),
          tgId: u.telegram_id,
          joinedAt: u.created_at?.toISOString().slice(0, 10),
          isBlocked: u.is_blocked ? 'Ha' : 'Yo\'q',
        });
      }

      // Sheet 2: Leaderboard
      const lbSheet = workbook.addWorksheet('Reyting');
      lbSheet.columns = [
        { header: 'O\'rin', key: 'rank', width: 8 },
        { header: 'Ism', key: 'name', width: 25 },
        { header: 'Eng yaxshi natija (%)', key: 'bestScore', width: 22 },
        { header: 'Jami testlar', key: 'sessions', width: 15 },
      ];
      const leaders = await this.sessionRepo.getLeaderboard(40);
      for (let i = 0; i < leaders.length; i++) {
        const u = await this.userRepo.findByTelegramId(String(leaders[i].user_id));
        lbSheet.addRow({
          rank: i + 1,
          name: u ? displayName(u.first_name, u.last_name, u.username) : 'Noma\'lum',
          bestScore: Number(leaders[i].best_score).toFixed(2),
          sessions: Number(leaders[i].sessions),
        });
      }

      // Sheet 3: Summary
      const summarySheet = workbook.addWorksheet('Umumiy');
      summarySheet.addRow(['Ko\'rsatkich', 'Qiymat']);
      summarySheet.addRow(['Jami foydalanuvchilar', await this.userRepo.countAll()]);
      summarySheet.addRow(['Bugun qo\'shilgan', await this.userRepo.countToday()]);
      summarySheet.addRow(['Jami testlar', await this.sessionRepo.countAllSessions()]);
      summarySheet.addRow(['Bugungi testlar', await this.sessionRepo.countTodaySessions()]);

      const buffer = await workbook.xlsx.writeBuffer();

      await ctx.replyWithDocument(
        { source: Buffer.from(buffer), filename: `statistika_${Date.now()}.xlsx` },
        { caption: '📊 Statistika hisoboti' },
      );
    } catch (e) {
      await ctx.reply('❌ Excel tayyorlashda xato yuz berdi.');
    }
  }
}
