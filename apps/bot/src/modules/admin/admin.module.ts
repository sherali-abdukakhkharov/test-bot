import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { RepositoriesModule } from '@/repositories/repositories.module';
import { AdminAuthHandler } from './auth/admin-auth.handler';
import { AdminSectionsHandler } from './sections/admin-sections.handler';
import { AdminTopicsHandler } from './topics/admin-topics.handler';
import { AdminQuestionsHandler } from './questions/admin-questions.handler';
import { AdminUsersHandler } from './users/admin-users.handler';
import { AdminStatisticsHandler } from './statistics/admin-statistics.handler';
import { AdminGuideHandler } from './guide/admin-guide.handler';
import { AdminAnnouncementsHandler } from './announcements/admin-announcements.handler';
import { AdminSupportHandler } from './support/admin-support.handler';
import { AdminSettingsHandler } from './settings/admin-settings.handler';
import { AdminDeployHandler } from './deploy/admin-deploy.handler';

const HANDLERS = [
  AdminAuthHandler,
  AdminSectionsHandler,
  AdminTopicsHandler,
  AdminQuestionsHandler,
  AdminUsersHandler,
  AdminStatisticsHandler,
  AdminGuideHandler,
  AdminAnnouncementsHandler,
  AdminSupportHandler,
  AdminSettingsHandler,
  AdminDeployHandler,
];

@Module({
  imports: [BotModule, RepositoriesModule],
  providers: HANDLERS,
})
export class AdminModule {}
