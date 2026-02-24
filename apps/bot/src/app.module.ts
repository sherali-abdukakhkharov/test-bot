import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { BotModule } from '@/bot/bot.module';
import { RegistrationModule } from '@/modules/registration/registration.module';
import { MainMenuModule } from '@/modules/main-menu/main-menu.module';
import { NavigationModule } from '@/modules/navigation/navigation.module';
import { TestModule } from '@/modules/test/test.module';
import { GuideModule } from '@/modules/guide/guide.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';
import { SupportModule } from '@/modules/support/support.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { WebAuthModule } from '@/modules/web-auth/web-auth.module';
import { ApiModule } from '@/api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RepositoriesModule,
    BotModule,
    // Feature modules
    RegistrationModule,
    MainMenuModule,
    NavigationModule,
    TestModule,
    GuideModule,
    LeaderboardModule,
    SupportModule,
    AdminModule,
    // Web API
    WebAuthModule,
    ApiModule,
  ],
})
export class AppModule {}
