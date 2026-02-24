import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { ApiModule } from '@/api/api.module';
import { WebAuthHandler } from './web-auth.handler';

@Module({
  imports: [BotModule, RepositoriesModule, ApiModule],
  providers: [WebAuthHandler],
})
export class WebAuthModule {}
