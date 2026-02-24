import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface OtpEntry {
  adminId: number;
  telegramId: string;
  role: 'super' | 'regular';
  expiresAt: Date;
  used: boolean;
}

@Injectable()
export class OtpService implements OnModuleDestroy {
  private readonly store = new Map<string, OtpEntry>();
  private readonly pruneInterval: NodeJS.Timeout;

  constructor() {
    this.pruneInterval = setInterval(() => this.prune(), 60_000);
  }

  generate(admin: {
    id: number;
    telegram_id: string;
    role: 'super' | 'regular';
  }): string {
    // Revoke any existing unused code for this admin
    for (const [code, entry] of this.store.entries()) {
      if (entry.adminId === admin.id && !entry.used) {
        this.store.delete(code);
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.store.set(code, {
      adminId: admin.id,
      telegramId: admin.telegram_id,
      role: admin.role,
      expiresAt: new Date(Date.now() + 15_000),
      used: false,
    });
    return code;
  }

  consume(code: string): OtpEntry | null {
    const entry = this.store.get(code);
    if (!entry) return null;
    if (entry.used) return null;
    if (entry.expiresAt < new Date()) {
      this.store.delete(code);
      return null;
    }
    entry.used = true;
    this.store.set(code, entry);
    return entry;
  }

  private prune(): void {
    const now = new Date();
    for (const [code, entry] of this.store.entries()) {
      if (entry.expiresAt < now || entry.used) {
        this.store.delete(code);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.pruneInterval);
  }
}
