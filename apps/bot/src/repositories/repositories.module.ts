import { Module } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { UserRepository } from './user.repository';
import { AdminRepository } from './admin.repository';
import { SectionRepository } from './section.repository';
import { TopicRepository } from './topic.repository';
import { QuestionRepository } from './question.repository';
import { TestSessionRepository } from './test-session.repository';
import { SupportRepository } from './support.repository';
import { GuideRepository } from './guide.repository';
import { AnnouncementRepository } from './announcement.repository';

const REPOS = [
  SettingsRepository,
  UserRepository,
  AdminRepository,
  SectionRepository,
  TopicRepository,
  QuestionRepository,
  TestSessionRepository,
  SupportRepository,
  GuideRepository,
  AnnouncementRepository,
];

@Module({
  providers: REPOS,
  exports: REPOS,
})
export class RepositoriesModule {}
