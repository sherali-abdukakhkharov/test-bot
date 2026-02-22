import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, HttpError, session } from 'grammy';
import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { conversations, createConversation } from '@grammyjs/conversations';
import { freeStorage } from '@grammyjs/storage-free';
import { BotContext, SessionData } from './context.type';
import { UserRepository } from '@/repositories/user.repository';
import { AdminRepository } from '@/repositories/admin.repository';
import { userMiddleware } from './middleware/user.middleware';
import { adminMiddleware } from './middleware/admin.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  readonly bot: Bot<BotContext>;

  constructor(
    private readonly config: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminRepository,
  ) {
    const token = this.config.getOrThrow<string>('BOT_TOKEN');
    this.bot = new Bot<BotContext>(token);
    this.setupMiddleware();
  }

  private setupMiddleware() {
    // Hydrate: makes ctx methods chainable
    this.bot.use(hydrate());

    // Auto-retry on flood control / 429 errors
    this.bot.api.config.use(autoRetry());

    // Logger
    this.bot.use(loggerMiddleware());

    // Sessions (stored on Telegram servers via storage-free)
    // Cast needed: storage-free v2.5 types don't align with grammy v1 StorageAdapter at compile time
    this.bot.use(
      session<SessionData, BotContext>({
        initial: (): SessionData => ({}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storage: freeStorage<SessionData>(this.bot.token) as any,
      }),
    );

    // Conversations plugin
    this.bot.use(conversations());

    // User upsert & block check
    this.bot.use(userMiddleware(this.userRepo));

    // Admin detection
    this.bot.use(adminMiddleware(this.adminRepo));
  }

  /** Register a conversation by name — called from feature modules */
  registerConversation(name: string, handler: (conversation: any, ctx: BotContext) => Promise<void>) {
    this.bot.use(createConversation(handler, name));
  }

  async onModuleInit() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error handling update ${ctx.update.update_id}:`);
      if (err.error instanceof GrammyError) {
        this.logger.error(`grammY error: ${err.error.message}`);
      } else if (err.error instanceof HttpError) {
        this.logger.error(`HTTP error: ${err.error.message}`);
      } else {
        this.logger.error(err.error);
      }
    });

    // Start polling in the background
    this.bot.start({
      onStart: (info) => this.logger.log(`Bot @${info.username} started polling`),
    });
  }

  async onApplicationShutdown() {
    await this.bot.stop();
    this.logger.log('Bot stopped');
  }
}
