import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { SupportHandler } from './support.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [SupportHandler],
})
export class SupportModule {}
