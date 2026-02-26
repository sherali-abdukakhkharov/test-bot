import { Context, SessionFlavor } from 'grammy';
import { HydrateFlavor } from '@grammyjs/hydrate';
import { UserRow } from '@/repositories/user.repository';
import { AdminRow } from '@/repositories/admin.repository';

export interface SessionData {
  /** Pending full name during registration (before confirmation) */
  pendingName?: string;
  /** Which section the user is browsing (for back-navigation) */
  currentSectionId?: number;
  /** Active test session id (bigint stored as string) */
  activeTestSessionId?: string;
  /** Current question index in session */
  questionIndex?: number;
  /** Question IDs shuffled for session */
  questionIds?: number[];
  /** Seconds allowed per question for the active test */
  timePerQuestionSec?: number;
  /** Admin pending-input state (for multi-step admin flows) */
  adminStep?: string;
  /** Temp data for admin wizard flows */
  adminWizard?: Record<string, unknown>;
}

export type BotContext = HydrateFlavor<
  Context &
    SessionFlavor<SessionData> & {
      /** Populated by userMiddleware for registered users */
      dbUser?: UserRow;
      /** Populated by adminMiddleware for approved admins */
      dbAdmin?: AdminRow;
    }
>;
