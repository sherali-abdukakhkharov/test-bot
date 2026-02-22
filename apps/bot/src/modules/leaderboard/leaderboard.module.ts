import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { LeaderboardHandler } from './leaderboard.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [LeaderboardHandler],
})
export class LeaderboardModule {}
