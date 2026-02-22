import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { RepositoriesModule } from '@/repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
