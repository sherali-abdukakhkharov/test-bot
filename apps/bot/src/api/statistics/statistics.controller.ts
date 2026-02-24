import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { TestSessionRepository } from '@/repositories/test-session.repository';
import { UserRepository } from '@/repositories/user.repository';
import { AdminRepository } from '@/repositories/admin.repository';
import { SupportRepository } from '@/repositories/support.repository';
import type { DashboardStatsDto, LeaderboardEntryDto } from '@arab-tili/shared-types';
import { displayName } from '@/common/utils/format';

@ApiTags('statistics')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly sessionRepo: TestSessionRepository,
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminRepository,
    private readonly supportRepo: SupportRepository,
  ) {}

  @Get('overview')
  async getOverview(): Promise<DashboardStatsDto> {
    const [totalUsers, todayUsers, totalSessions, todaySessions, approvedAdmins, openThreads] =
      await Promise.all([
        this.userRepo.countAll(),
        this.userRepo.countToday(),
        this.sessionRepo.countAllSessions(),
        this.sessionRepo.countTodaySessions(),
        this.adminRepo.countApproved(),
        this.supportRepo.findThreads('open', 1, 1).then((r) => r.total),
      ]);
    return { totalUsers, todayUsers, totalSessions, todaySessions, approvedAdmins, openSupportThreads: openThreads };
  }

  @Get('leaderboard')
  async getLeaderboard(): Promise<LeaderboardEntryDto[]> {
    const leaders = await this.sessionRepo.getLeaderboard(40);
    const result: LeaderboardEntryDto[] = [];
    for (let i = 0; i < leaders.length; i++) {
      const user = await this.userRepo.findById(leaders[i].user_id);
      result.push({
        rank: i + 1,
        userId: String(leaders[i].user_id),
        firstName: user?.first_name ?? null,
        lastName: user?.last_name ?? null,
        username: user?.username ?? null,
        bestScore: Number(leaders[i].best_score),
        sessionsCount: Number(leaders[i].sessions),
      });
    }
    return result;
  }

  @Get('export')
  async exportExcel(@Res() res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Users
    const usersSheet = workbook.addWorksheet('Foydalanuvchilar');
    usersSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Ism', key: 'name', width: 25 },
      { header: 'Telegram ID', key: 'tgId', width: 20 },
      { header: "Qo'shilgan sana", key: 'joinedAt', width: 20 },
      { header: 'Bloklangan', key: 'isBlocked', width: 15 },
    ];
    const { rows: allUsers } = await this.userRepo.findAll({ page: 1, limit: 10000 });
    for (const u of allUsers) {
      usersSheet.addRow({
        id: String(u.id),
        name: displayName(u.first_name, u.last_name, u.username),
        tgId: u.telegram_id,
        joinedAt: u.created_at?.toISOString().slice(0, 10),
        isBlocked: u.is_blocked ? "Ha" : "Yo'q",
      });
    }

    // Sheet 2: Leaderboard
    const lbSheet = workbook.addWorksheet('Reyting');
    lbSheet.columns = [
      { header: "O'rin", key: 'rank', width: 8 },
      { header: 'Ism', key: 'name', width: 25 },
      { header: "Eng yaxshi natija (%)", key: 'bestScore', width: 22 },
      { header: 'Jami testlar', key: 'sessions', width: 15 },
    ];
    const leaders = await this.sessionRepo.getLeaderboard(40);
    for (let i = 0; i < leaders.length; i++) {
      const u = await this.userRepo.findByTelegramId(String(leaders[i].user_id));
      lbSheet.addRow({
        rank: i + 1,
        name: u ? displayName(u.first_name, u.last_name, u.username) : "Noma'lum",
        bestScore: Number(leaders[i].best_score).toFixed(2),
        sessions: Number(leaders[i].sessions),
      });
    }

    // Sheet 3: Summary
    const summarySheet = workbook.addWorksheet('Umumiy');
    summarySheet.addRow(["Ko'rsatkich", 'Qiymat']);
    summarySheet.addRow(['Jami foydalanuvchilar', await this.userRepo.countAll()]);
    summarySheet.addRow(["Bugun qo'shilgan", await this.userRepo.countToday()]);
    summarySheet.addRow(['Jami testlar', await this.sessionRepo.countAllSessions()]);
    summarySheet.addRow(['Bugungi testlar', await this.sessionRepo.countTodaySessions()]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=statistika_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
