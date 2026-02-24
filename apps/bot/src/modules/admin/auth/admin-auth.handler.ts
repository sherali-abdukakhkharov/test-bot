import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '@/bot/bot.service';
import { AdminRepository } from '@/repositories/admin.repository';
import { SettingsRepository } from '@/repositories/settings.repository';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { adminMenuKeyboard } from '@/common/utils/keyboard';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AdminAuthHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly adminRepo: AdminRepository,
    private readonly settingsRepo: SettingsRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const bot = this.botService.bot;

    // /admin command — register or authenticate as admin
    bot.command('admin', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const superAdminId = this.config.get<string>('SUPER_ADMIN_TG_ID');
      const telegramId = String(from.id);
      const isSuperAdminId = telegramId === superAdminId;

      const existing = await this.adminRepo.findByTelegramId(telegramId);

      if (existing) {
        if (existing.is_blocked) {
          await ctx.reply('⛔ Sizning admin hisobingiz bloklangan.');
          return;
        }
        if (!existing.is_approved) {
          await ctx.reply('⏳ Sizning admin so\'rovingiz hali ko\'rib chiqilmagan.');
          return;
        }
        await ctx.reply(
          `✅ Xush kelibsiz, Admin!\n\n` +
            `👤 Ism: ${from.first_name ?? ''}\n` +
            `🔑 Rol: ${existing.role === 'super' ? 'Super Admin' : 'Admin'}`,
          { reply_markup: adminMenuKeyboard() },
        );
        return;
      }

      // New admin registration
      if (isSuperAdminId) {
        // Auto-approve super admin on first run
        await this.adminRepo.create({
          telegram_id: telegramId,
          first_name: from.first_name ?? null,
          last_name: from.last_name ?? null,
          username: from.username ?? null,
          role: 'super',
          is_approved: true,
        });
        await ctx.reply('👑 Siz Super Admin sifatida ro\'yxatdan o\'tdingiz va tasdiqlandi!', { reply_markup: adminMenuKeyboard() });
        return;
      }

      // Ask for password
      ctx.session.adminStep = 'awaiting_admin_password';
      await ctx.reply(
        '🔐 Admin bo\'lish uchun parol kiriting:\n\n' +
          '⚠️ Parolni to\'g\'ri kiritmagan holatda bloklanishingiz mumkin.',
      );
    });

    // Handle password input
    bot.on('message:text', async (ctx, next) => {
      if (ctx.session.adminStep !== 'awaiting_admin_password') return next();

      const from = ctx.from;
      if (!from) return;

      const telegramId = String(from.id);
      const existing = await this.adminRepo.findByTelegramId(telegramId);
      const inputPassword = ctx.message.text.trim();

      // Check shared admin password
      const sharedHash = await this.settingsRepo.get('admin_shared_password');
      const superHash = await this.settingsRepo.get('super_admin_password');

      const isAdmin = sharedHash && (await bcrypt.compare(inputPassword, sharedHash).catch(() => inputPassword === sharedHash));
      const isSuper = superHash && (await bcrypt.compare(inputPassword, superHash).catch(() => inputPassword === superHash));

      if (!isAdmin && !isSuper) {
        // Wrong password
        if (existing) {
          await this.adminRepo.incrementFailedAttempts(existing.id);
          const updated = await this.adminRepo.findById(existing.id);
          if (updated && updated.failed_attempt_count >= MAX_FAILED_ATTEMPTS) {
            await this.adminRepo.update(existing.id, { is_blocked: true });
            ctx.session.adminStep = undefined;
            await ctx.reply('⛔ Juda ko\'p noto\'g\'ri urinish. Hisobingiz bloklandi.');
            return;
          }
        }
        await ctx.reply('❌ Noto\'g\'ri parol. Qayta urinib ko\'ring.');
        return;
      }

      ctx.session.adminStep = undefined;

      if (existing) {
        await this.adminRepo.resetFailedAttempts(existing.id);
        await ctx.reply('✅ Xush kelibsiz, Admin!', { reply_markup: adminMenuKeyboard() });
        return;
      }

      // Create new admin — needs approval (unless super)
      const role = isSuper ? 'super' : 'regular';
      const needsApproval = role === 'regular';

      await this.adminRepo.create({
        telegram_id: telegramId,
        first_name: from.first_name ?? null,
        last_name: from.last_name ?? null,
        username: from.username ?? null,
        role,
        is_approved: !needsApproval,
      });

      if (needsApproval) {
        await ctx.reply(
          '✅ So\'rovingiz qabul qilindi!\n\n' +
            'Super admin tasdiqlagunga qadar kuting. Siz haqingizda xabar beriladi.',
        );
        // Notify all approved super admins; fall back to env var during bootstrap
        const superAdmins = await this.adminRepo.findAllApprovedSuperAdmins();
        const notifyIds =
          superAdmins.length > 0
            ? superAdmins.map((a) => a.telegram_id)
            : [this.config.get<string>('SUPER_ADMIN_TG_ID')].filter((id): id is string => Boolean(id));

        const message =
          `🆕 Yangi admin so\'rovi:\n\n` +
          `👤 ${from.first_name ?? ''} ${from.last_name ?? ''}\n` +
          `🔗 @${from.username ?? 'yo\'q'}\n` +
          `🆔 ${telegramId}`;

        await Promise.allSettled(notifyIds.map((id) => bot.api.sendMessage(id, message)));
      } else {
        await ctx.reply('👑 Siz Super Admin sifatida tasdiqlandi!', { reply_markup: adminMenuKeyboard() });
      }
    });
  }
}
