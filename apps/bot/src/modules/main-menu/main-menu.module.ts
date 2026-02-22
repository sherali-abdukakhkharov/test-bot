import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { MainMenuHandler } from './main-menu.handler';

@Module({
  imports: [BotModule],
  providers: [MainMenuHandler],
})
export class MainMenuModule {}
