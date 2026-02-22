import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { RegistrationHandler } from './registration.handler';

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: [RegistrationHandler],
})
export class RegistrationModule {}
