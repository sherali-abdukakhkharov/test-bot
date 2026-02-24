// ─── JWT ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number;
  telegramId: string;
  role: 'super' | 'regular';
  iat?: number;
  exp?: number;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthOtpRequest {
  code: string;
}

export interface AuthResponse {
  accessToken: string;
  role: 'super' | 'regular';
  expiresAt: string;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminDto {
  id: number;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: 'super' | 'regular';
  isApproved: boolean;
  isBlocked: boolean;
  failedAttemptCount: number;
  createdAt: string;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  nameScript: string | null;
  registrationState: string;
  isBlocked: boolean;
  createdAt: string;
}

// ─── Section ─────────────────────────────────────────────────────────────────

export interface SectionDto {
  id: number;
  parentId: number | null;
  title: string;
  description: string | null;
  sortOrder: number;
  isLockedByDefault: boolean;
  unlockRequiredSection: number | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface SectionTreeNode extends SectionDto {
  children: SectionTreeNode[];
}

// ─── Topic ───────────────────────────────────────────────────────────────────

export interface TopicDto {
  id: number;
  sectionId: number;
  title: string;
  sortOrder: number;
  timePerQuestionSec: number;
  optionsCount: number;
  dailyAttemptLimit: number;
  isLockedByDefault: boolean;
  unlockRequiredTopic: number | null;
  isDeleted: boolean;
  questionCount?: number;
  createdAt: string;
}

// ─── Question ────────────────────────────────────────────────────────────────

export interface AnswerOptionDto {
  id: number;
  questionId: number;
  bodyText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuestionDto {
  id: number;
  topicId: number;
  bodyText: string | null;
  mediaType: string | null;
  mediaFileId: string | null;
  sortOrder: number;
  isDeleted: boolean;
  options: AnswerOptionDto[];
  createdAt: string;
}

// ─── Test Session ─────────────────────────────────────────────────────────────

export interface TestSessionDto {
  id: string;
  userId: string;
  topicId: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  totalQuestions: number;
  correctCount: number;
  scorePercent: string;
  startedAt: string;
  finishedAt: string | null;
}

// ─── Support ─────────────────────────────────────────────────────────────────

export interface SupportThreadDto {
  id: string;
  userId: string;
  userFirstName: string | null;
  userLastName: string | null;
  status: 'open' | 'claimed' | 'closed';
  claimedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageDto {
  id: string;
  threadId: string;
  senderType: 'user' | 'admin';
  senderId: string;
  bodyText: string | null;
  mediaType: string | null;
  mediaFileId: string | null;
  sentAt: string;
}

// ─── Guide ───────────────────────────────────────────────────────────────────

export interface GuideItemDto {
  id: number;
  contentType: 'text' | 'video';
  bodyText: string | null;
  mediaFileId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Announcement ─────────────────────────────────────────────────────────────

export interface AnnouncementDto {
  id: string;
  createdBy: number | null;
  bodyText: string | null;
  mediaType: string | null;
  mediaFileId: string | null;
  expiresAt: string | null;
  createdAt: string;
  isExpired: boolean;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface DashboardStatsDto {
  totalUsers: number;
  todayUsers: number;
  totalSessions: number;
  todaySessions: number;
  approvedAdmins: number;
  openSupportThreads: number;
}

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  bestScore: number;
  sessionsCount: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SettingsDto {
  adminSharedPasswordSet: boolean;
  superAdminPasswordSet: boolean;
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

export interface ReorderItem {
  id: number;
  sortOrder: number;
}
