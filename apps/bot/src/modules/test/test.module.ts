import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { TestHandler } from './test.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [TestHandler],
})
export class TestModule {}
