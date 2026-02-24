import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { BotModule } from '@/bot/bot.module';

import { OtpService } from './auth/otp.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { AuthController } from './auth/auth.controller';
import { SectionsController } from './sections/sections.controller';
import { TopicsController } from './topics/topics.controller';
import { QuestionsController } from './questions/questions.controller';
import { UsersController } from './users/users.controller';
import { AdminsController } from './admins/admins.controller';
import { StatisticsController } from './statistics/statistics.controller';
import { GuideController } from './guide/guide.controller';
import { AnnouncementsController } from './announcements/announcements.controller';
import { SupportController } from './support/support.controller';
import { SettingsController } from './settings/settings.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as any },
      }),
    }),
    RepositoriesModule,
    BotModule,
  ],
  controllers: [
    AuthController,
    SectionsController,
    TopicsController,
    QuestionsController,
    UsersController,
    AdminsController,
    StatisticsController,
    GuideController,
    AnnouncementsController,
    SupportController,
    SettingsController,
  ],
  providers: [OtpService, JwtStrategy],
  exports: [OtpService],
})
export class ApiModule {}
