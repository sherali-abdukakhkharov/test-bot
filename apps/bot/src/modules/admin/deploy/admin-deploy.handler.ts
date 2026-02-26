import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BotService } from '@/bot/bot.service';

const execAsync = promisify(exec);

@Injectable()
export class AdminDeployHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    bot.command('deploy', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const superAdminId = this.config.get<string>('SUPER_ADMIN_TG_ID');
      if (String(from.id) !== superAdminId) {
        await ctx.reply('⛔ Bu buyruq faqat Super Admin uchun.');
        return;
      }

      const projectRoot =
        this.config.get<string>('DEPLOY_PROJECT_ROOT') ?? process.cwd();
      const execOpts = { cwd: projectRoot };

      const lines: string[] = [];
      const statusMsg = await ctx.reply('Deploying...');
      const chatId = statusMsg.chat.id;
      const msgId = statusMsg.message_id;

      const update = async (text: string) => {
        try {
          await bot.api.editMessageText(chatId, msgId, text, {
            parse_mode: 'HTML',
          });
        } catch {
          // ignore edit failures (e.g. unchanged text)
        }
      };

      // Step 1: git pull
      try {
        const { stdout } = await execAsync('git pull', execOpts);
        const summary = stdout.trim().split('\n').pop() ?? 'done';
        lines.push(`git pull — <b>${summary}</b>`);
        await update(lines.join('\n'));
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr ?? String(err);
        lines.push('git pull — FAILED');
        await update(
          lines.join('\n') + `\n\n<code>${stderr.slice(0, 300)}</code>`,
        );
        return;
      }

      // Step 2: npm run bot:build
      lines.push('Building bot...');
      await update(lines.join('\n'));
      try {
        await execAsync('npm run bot:build', execOpts);
        lines[lines.length - 1] = 'Building bot — done';
        await update(lines.join('\n'));
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr ?? String(err);
        lines[lines.length - 1] = 'Building bot — FAILED';
        await update(
          lines.join('\n') + `\n\n<code>${stderr.slice(0, 300)}</code>`,
        );
        return;
      }

      // Step 3: npm run web:build
      lines.push('Building web...');
      await update(lines.join('\n'));
      try {
        await execAsync('npm run web:build', execOpts);
        lines[lines.length - 1] = 'Building web — done';
        await update(lines.join('\n'));
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr ?? String(err);
        lines[lines.length - 1] = 'Building web — FAILED';
        await update(
          lines.join('\n') + `\n\n<code>${stderr.slice(0, 300)}</code>`,
        );
        return;
      }

      // Step 4: Notify BEFORE restart (process dies after this)
      lines.push('Restarting...');
      await update(lines.join('\n'));

      // Step 5: pm2 restart — kills this process
      try {
        await execAsync('pm2 restart arab-tili-bot', execOpts);
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr ?? String(err);
        lines[lines.length - 1] = 'pm2 restart — FAILED';
        await update(
          lines.join('\n') + `\n\n<code>${stderr.slice(0, 300)}</code>`,
        );
      }
    });
  }
}
