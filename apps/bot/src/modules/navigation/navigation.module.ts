import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { NavigationHandler } from './navigation.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [NavigationHandler],
})
export class NavigationModule {}
