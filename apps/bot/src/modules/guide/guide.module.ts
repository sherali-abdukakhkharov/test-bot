import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { GuideHandler } from './guide.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [GuideHandler],
})
export class GuideModule {}
