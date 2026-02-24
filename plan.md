# Arab Tili Yordamchi Bot — Production Implementation Plan

> **Stack**: NestJS · grammY · PostgreSQL 16 · Knex.js · TypeScript · Docker
> **Spec**: `docs/bot-doc.pdf` · **DB**: `docs/db-design.dbml` · **Flows**: `docs/bot-flow-canvas.html`
> **Approach**: Module-by-module, each phase is independently shippable.

---

## Legend

- `[ ]` Not started
- `[x]` Completed
- `[-]` Skipped / deferred

---

## Phase 0 — Project Scaffolding

### 0.1 Initialize NestJS Project
- [x] Run `nest new . --package-manager=npm --language=TS` (or bun/yarn per preference)
- [x] Delete generated `AppController`, `AppService`, keep only `AppModule`
- [x] Set up `src/` folder structure (see § File Layout below)
- [x] Configure `tsconfig.json` — strict mode, decorators, path aliases (`@/`)
- [x] Add `.nvmrc` pinned to Node 20 LTS

### 0.2 Install All Dependencies

**Runtime deps:**
- [x] `grammy` `@grammyjs/session` `@grammyjs/conversations` `@grammyjs/auto-retry`
- [x] `@nestjs/config` `joi` — env validation
- [x] `knex` `pg` — DB layer
- [x] `bcryptjs` `@types/bcryptjs`
- [x] `exceljs` — Excel export
- [x] `papaparse` `@types/papaparse` — CSV bulk import
- [x] `dayjs` — date/timezone handling (Tashkent UTC+5)

**Dev deps:**
- [x] `@nestjs/cli` `@nestjs/testing`
- [x] `jest` `ts-jest` `supertest`
- [x] `eslint` `prettier` `eslint-config-prettier`
- [x] `@types/node` `tsx` `ts-node`

### 0.3 Environment Configuration
- [x] Create `.env.example` with all required keys:
  ```
  NODE_ENV=development
  BOT_TOKEN=
  SUPER_ADMIN_TG_ID=
  DATABASE_URL=postgresql://user:pass@localhost:5432/arab_tili_bot
  DATABASE_POOL_MIN=2
  DATABASE_POOL_MAX=10
  BOT_WEBHOOK_DOMAIN=          # e.g. https://yourapp.fly.dev
  BOT_WEBHOOK_SECRET=          # random secret for webhook validation
  PORT=3000
  ```
- [x] Create `src/config/configuration.ts` — typed config factory with Joi validation
- [x] Add `.env` to `.gitignore`

### 0.4 Linting & Formatting
- [x] Configure `eslint.config.js` (flat config) with TypeScript + Prettier rules
- [x] Configure `.prettierrc` (singleQuote, trailingComma: all, semi: true)
- [x] Add `npm run lint` and `npm run format` scripts
- [x] Set up `husky` + `lint-staged` for pre-commit hook

### 0.5 Docker Development Environment
- [x] Write `docker-compose.dev.yml`:
  - `postgres:16-alpine` service with volume
  - `adminer` service (DB GUI at port 8080)
- [x] Write `Makefile` with shortcuts: `make up`, `make down`, `make migrate`, `make seed`
- [x] Verify `docker compose up -d` starts PostgreSQL and bot connects

---

## Phase 1 — Database Layer

### 1.1 Knex Setup
- [x] Create `src/database/database.module.ts` — global NestJS module exporting Knex instance
- [x] Create `src/database/knex.provider.ts` — Knex factory using `DATABASE_URL` + pool config
- [x] Create `knexfile.ts` at project root — used by CLI migrations
- [x] Export `Knex` token as `KNEX_CONNECTION` for injection

### 1.2 Migrations (run in order, one file per table)

> Convention: `YYYYMMDDHHMMSS_create_<table>.ts`

- [x] `001` — `settings` (key-value config store)
- [x] `002` — `stickers` (correct/wrong pool)
- [x] `003` — `users` (telegram_id, registration_state, is_blocked)
- [x] `004` — `admins` (role, is_approved, is_blocked, failed_attempt_count, password_hash)
- [x] `005` — `sections` (parent_id self-ref, unlock_required_section self-ref, is_deleted)
- [x] `006` — `section_unlocks` (user_id, section_id — unique, immutable)
- [x] `007` — `topics` (section_id, time_per_question_sec, options_count, daily_attempt_limit, unlock_required_topic, is_deleted)
- [x] `008` — `topic_unlocks` (user_id, topic_id — unique, immutable)
- [x] `009` — `questions` (topic_id, body_text, media_type, media_file_id, is_deleted)
- [x] `010` — `answer_options` (question_id, body_text, is_correct, is_deleted)
- [x] `011` — `test_sessions` (user_id, topic_id, status, total_questions, correct_count, wrong_count, score_percent, attempt_date_tashkent)
- [x] `012` — `test_answers` (session_id, question_id, snapshots, chosen_option_id, is_correct)
- [x] `013` — `daily_attempt_counts` (user_id, topic_id, attempt_date — unique composite)
- [x] `014` — `support_threads` (user_id, status, claimed_by)
- [x] `015` — `support_messages` (thread_id, sender_type, sender_id, body_text, media_type, media_file_id)
- [x] `016` — `guide_items` (content_type, body_text, media_file_id, sort_order, is_active)
- [x] `017` — `announcements` (created_by, body_text, media_type, media_file_id, expires_at)
- [x] Verify all indexes exist per `db-design.dbml`
- [x] Run `knex migrate:latest` and confirm `\dt` shows 17 tables

### 1.3 Seed Data
- [x] Seed `settings`: insert `super_admin_password` placeholder (empty) and `admin_shared_password` placeholder
- [x] Seed `stickers`: add at least 5 correct + 5 wrong sticker `file_id` placeholders (replace with real IDs once bot is live)
- [x] Seed sample `sections`, `topics`, `questions`, `answer_options` for dev/testing

### 1.4 Database Repository Pattern
- [x] Create `src/database/repositories/` directory
- [x] Write base `BaseRepository<T>` with: `findById`, `findOne`, `findMany`, `insert`, `update`, `delete`
- [x] One repository per domain entity (17 total — match tables)
- [x] All repositories injectable via NestJS DI

---

## Phase 2 — Bot Core Infrastructure

### 2.1 NestJS + grammY Bridge
- [x] Create `BotModule` (`src/bot/bot.module.ts`) — global module
- [x] Create `BotService` (`src/bot/bot.service.ts`):
  - Instantiates `Bot<MyContext>` from `grammy`
  - Starts bot with **long polling** in dev, **webhook** in production
  - Graceful shutdown on SIGINT/SIGTERM
- [x] Create `MyContext` type (`src/bot/context.type.ts`) extending grammY `Context` with session data
- [x] Register `BotService` as `onModuleInit` + `onModuleDestroy`

### 2.2 Session Middleware
- [x] Install and configure `@grammyjs/session` with PostgreSQL storage adapter
- [x] Session schema (`SessionData`):
  ```typescript
  interface SessionData {
    registrationState: 'not_registered' | 'name_entered' | 'confirmed';
    pendingName?: string;          // name awaiting confirmation
    adminState?: AdminState;       // current admin conversation state
    testSession?: ActiveTestState; // current in-progress test
    supportState?: 'waiting_message'; // support input mode
  }
  ```
- [x] Store sessions in DB (custom KV table) or use `@grammyjs/storage-knex` (if available) else use grammY's built-in memory + persist on changes

### 2.3 Middleware Stack (applied globally in order)
- [x] **Logging middleware** — log every update: user_id, update_type, timestamp, text/callback
- [x] **User hydration middleware** — load/create user row from `users` table on every update, attach to `ctx.user`
- [x] **Block check middleware** — if `ctx.user.is_blocked`, reply "Siz bloklangansiz" and stop
- [x] **Registration guard middleware** — if `registration_state !== 'confirmed'`, redirect to registration flow (skip for `/start`)
- [x] **Active test guard middleware** — if user has `in_progress` test session, only allow test-related callbacks; send reminder for any other text

### 2.4 Error Handling
- [x] Global `bot.catch()` handler — log error + notify super admin via Telegram
- [x] Wrap all handlers in try/catch with graceful "Xatolik yuz berdi, qaytadan urinib ko'ring" fallback
- [x] Create `ErrorService` for structured error reporting

### 2.5 Utilities
- [x] `src/common/helpers/tashkent-date.ts` — `getTashkentDate(): string` (YYYY-MM-DD, UTC+5)
- [x] `src/common/helpers/keyboard.ts` — factory functions for common keyboards
- [x] `src/common/helpers/format.ts` — message formatters (score, date, name)
- [x] `src/common/constants/` — callback_data prefixes, state enums, limits

---

## Phase 3 — User Registration Module

> Flow reference: `bot-flow-canvas.html` → Tab 1 (Registration)

### 3.1 Module Setup
- [x] Create `src/modules/users/users.module.ts`
- [x] Create `src/modules/users/users.service.ts` (DB operations)
- [x] Create `src/modules/users/users.handler.ts` (grammY handler registration)

### 3.2 `/start` Command Handler
- [x] If `registration_state === 'confirmed'`: send "Hurmatli {name}, siz allaqachon ro'yxatdan o'tgansiz." + show main menu reply keyboard
- [x] If not registered: send 2 sequential messages:
  - Message 1: Bot description text
  - Message 2: "Iltimos, ism-familiyangiz bilan ro'yxatdan o'ting" (no buttons)
- [x] Set `registration_state = 'not_registered'` in session

### 3.3 Name Input Handler
- [x] Listen for text messages when `registration_state === 'not_registered'`
- [x] **Validation rules**:
  - Must contain 2+ words (split by space)
  - Each word ≥ 2 characters
  - Characters must be from one script only: Latin `[A-Za-z']`, Cyrillic `[А-Яа-яЁёA-Za-z'Oo']`, or Arabic `[\u0600-\u06FF\s]`
  - No digits, no special characters except apostrophe
  - Reject if starts with `/` (command)
  - Reject emoji (Unicode emoji ranges)
- [x] If invalid: reply "Iltimos, ism-familiyangizni kiriting.\nNamuna: Abdulloh Karimov"
- [x] If valid: trim, auto-capitalize each word, store in `session.pendingName`, set `registration_state = 'name_entered'`
- [x] Send confirmation message with inline keyboard: `[✅ Ha] [❌ Yo'q]`

### 3.4 Name Confirmation Callback Handlers
- [x] `callback_data: 'confirm_name:yes'`:
  - Insert/update `users` row with `first_name`, `last_name`, `registration_state = 'confirmed'`
  - Parse name: first word = `first_name`, rest = `last_name`
  - Answer callback, edit message to "🎉 Hurmatli {name}, ro'yxatdan o'tdingiz!"
  - Send main menu reply keyboard
- [x] `callback_data: 'confirm_name:no'`:
  - Answer callback, edit message to "Iltimos, ism-familiyangizni namunadagidek qaytadan kiriting."
  - Set `registration_state = 'not_registered'`, clear `pendingName`

### 3.5 Script Detection
- [x] Detect script from the entered name, store in `users.name_script` (`'latin'|'cyrillic'|'arabic'`)
- [x] No mixed scripts allowed — reject if mixed

---

## Phase 4 — Main Menu

> Flow reference: `bot-flow-canvas.html` → Tab 2 (Main Menu)

### 4.1 Reply Keyboard Definition
- [x] Create `mainMenuKeyboard()` helper returning `ReplyKeyboardMarkup` with 6 rows:
  ```
  [ 📚 Lug'at yodlash ]
  [      📝 Test      ]
  [   📊 Natijalarim  ]
  [ 🏆 Top o'quvchilar ]
  [    📖 Qo'llanma   ]
  [     ❓ Yordam     ]
  ```
- [x] `sendMainMenu(ctx)` utility — sends "Menyuni tanlang:" + `mainMenuKeyboard()`

### 4.2 Main Menu Router
- [x] Register `hears` handlers for each of the 6 button texts (exact match)
- [x] Route to the correct module handler:
  - `📚 Lug'at yodlash` → placeholder "Tez kunda..." message
  - `📝 Test` → `TestModule.showSectionList()`
  - `📊 Natijalarim` → `ResultsModule.showMyResults()`
  - `🏆 Top o'quvchilar` → `LeaderboardModule.showLeaderboard()`
  - `📖 Qo'llanma` → `GuideModule.sendGuide()`
  - `❓ Yordam` → `SupportModule.enterSupport()`

---

## Phase 5 — Sections & Topics Browser

> Flow reference: `bot-flow-canvas.html` → Tab 3 (S1, S2, S3) and Tab 4 (Lock System)

### 5.1 Module Setup
- [x] Create `src/modules/content/content.module.ts`
- [x] Create `src/modules/content/content.service.ts`
- [x] Create `src/modules/content/content.handler.ts`

### 5.2 Section List
- [x] `showSectionList(ctx, parentId = null)`:
  - Query `sections` where `parent_id = parentId AND is_deleted = false`
  - Filter out sections with no visible topics/sub-sections (recursive check)
  - Sort by `sort_order`
  - For each section, check lock status for current user:
    - If `is_locked_by_default = false` → always shown as 🔓
    - If `is_locked_by_default = true AND unlock_required_section IS NULL` → always locked 🔒
    - If `is_locked_by_default = true AND unlock_required_section IS NOT NULL`:
      - Check `section_unlocks(user_id, section_id)` → if exists → 🔓
      - Else → 🔒
  - Build inline keyboard: one button per section, label = `{icon} {section.title}`
  - Add `⬅️ Orqaga` button (goes to parent or main menu)
  - Edit existing message or send new one

### 5.3 Section Callback Handler
- [x] `callback_data: 'section:{sectionId}'`:
  - If section is locked: show lock message "🔒 Hozircha yopiq.\nOchish uchun avval [prerequisite section] avg ≥ 90%"
  - If section has sub-sections: show sub-section list (recursive)
  - If section has topics: show topic list

### 5.4 Topic List
- [x] `showTopicList(ctx, sectionId)`:
  - Query `topics` where `section_id = sectionId AND is_deleted = false`
  - Filter out topics with no active questions
  - Sort by `sort_order`
  - For each topic, check lock status:
    - If `is_locked_by_default = false` → 🔓
    - Else check `topic_unlocks(user_id, topic_id)` → if exists → 🔓 else → 🔒
  - Build inline keyboard: `{icon} {topic.title} ({questionCount} savol)`
  - Add `⬅️ Orqaga` button

### 5.5 Topic Callback Handler
- [x] `callback_data: 'topic:{topicId}'`:
  - If topic is locked: show "🔒 Hozircha yopiq.\nOchish uchun [prerequisite topic]dan kamida 90% oling." + Orqaga button
  - Else: show pre-test info screen

### 5.6 Pre-Test Info Screen
- [x] `showTopicInfo(ctx, topicId)`:
  - Load topic details (title, question count, time_per_question_sec, daily_attempt_limit)
  - Get today's attempt count from `daily_attempt_counts`
  - Remaining = `daily_attempt_limit - count`
  - If remaining > 0: show `▶️ Testni boshlash` + `⬅️ Orqaga`
  - If remaining = 0: show warning "⚠️ Imkoniyatingiz tugagan. Ertaga qayta urinib ko'ring." + only `⬅️ Orqaga`
  - Display: topic title, question count, time per question, `{remaining}/{limit}` attempts

---

## Phase 6 — Test Engine

> Flow reference: `bot-flow-canvas.html` → Tab 3 (S4–S7)

### 6.1 Module Setup
- [x] Create `src/modules/test/test.module.ts`
- [x] Create `src/modules/test/test.service.ts`
- [x] Create `src/modules/test/test.handler.ts`
- [x] Create `src/modules/test/test-timer.service.ts` (setTimeout per question)

### 6.2 Start Test
- [x] `callback_data: 'test:start:{topicId}'`:
  1. Re-check daily attempt limit (race condition guard)
  2. UPSERT `daily_attempt_counts` (increment count by 1)
  3. Load all active questions for topic (`is_deleted = false`), shuffled
  4. Create `test_sessions` row (status=`in_progress`, `total_questions`, `attempt_date_tashkent`)
  5. Pre-create all `test_answers` rows with `chosen_option_id = NULL, is_correct = false` (for abandon safety)
  6. Store in `session.testSession`: `{ sessionId, topicId, questions[], currentIndex: 0, msgId }`
  7. Call `sendQuestion(ctx, 0)`

### 6.3 Send Question
- [x] `sendQuestion(ctx, questionIndex)`:
  - Load question + answer options (shuffled, but always same number as `topic.options_count`)
  - Build progress bar: `n/total` + visual `━━━░░` bar
  - Build message: question header + progress + body_text + optional media
  - Build inline keyboard: 2 options per row (A/B top, C/D bottom) + `🛑 To'xtatish` button
  - Delete previous question message (if exists)
  - Send new question message, store `msgId` in session
  - Start timer: `setTimeout(() => handleTimeout(ctx, sessionId, questionIndex), timePerQuestion * 1000)`
  - Store timer reference in session (or use a Map in TestTimerService)

### 6.4 Answer Handler
- [x] `callback_data: 'answer:{sessionId}:{questionIndex}:{optionId}'`:
  1. Validate: session is still `in_progress`, questionIndex matches current
  2. Cancel running timer for this question
  3. Load correct option for this question
  4. Determine `is_correct = chosen_option_id === correct_option_id`
  5. Update `test_answers` row:
     - `chosen_option_id`, `chosen_option_text`, `is_correct`, `answered_at`, `time_spent_sec`
     - `question_snapshot` (already set on creation; update if text changed — or keep original)
  6. Update `test_sessions.correct_count` or `wrong_count`
  7. Answer callback query
  8. Disable inline buttons on question message (edit keyboard to empty)
  9. Send sticker (random correct/wrong from `stickers` table)
  10. Wait 3 seconds via `setTimeout`
  11. Delete sticker message
  12. If more questions: call `sendQuestion(ctx, questionIndex + 1)`
  13. If last question: call `finishTest(ctx, sessionId)`

### 6.5 Timeout Handler
- [x] If timer fires before user answers:
  1. Same as wrong answer flow (step 5 onward)
  2. `chosen_option_id = NULL`, `is_correct = false`, `chosen_option_text = NULL`
  3. Send wrong sticker + advance

### 6.6 Stop Test Flow
- [x] `callback_data: 'test:stop_confirm:{sessionId}'`:
  - Edit question message to: "⚠️ Testni to'xtatsangiz imkoniyat ketadi. Davom etamizmi?"
  - Inline keyboard: `[✅ Ha, to'xtat] [❌ Yo'q, davom et]`
- [x] `callback_data: 'test:stop_yes:{sessionId}'`:
  - Cancel active timer
  - Set remaining unanswered `test_answers` rows to `is_correct = false`
  - Call `finishTest(ctx, sessionId, abandoned=true)`
- [x] `callback_data: 'test:stop_no:{sessionId}'`:
  - Re-send current question (restore question message)

### 6.7 Finish Test
- [x] `finishTest(ctx, sessionId, abandoned=false)`:
  1. Calculate final `score_percent = correct_count / total_questions * 100`
  2. Update `test_sessions`: `status = completed|abandoned`, `score_percent`, `wrong_count`, `finished_at`
  3. Clear `session.testSession`
  4. Check unlock conditions (see Phase 7)
  5. Send result message:
     ```
     📊 Natija
     Mavzu: {topicTitle}
     ✅ To'g'ri: {correct_count}
     ❌ Xato: {wrong_count}
     📈 Foiz: {score_percent}%
     ```
  6. Inline keyboard: `⬅️ Orqaga` (back to topic info or main menu)

### 6.8 Unlock Check (after test completion)
- [x] After each completed test, run unlock checker:
  - **Topic unlock**: check if any topic has `unlock_required_topic = this_topic_id`
    - Get user's `MAX(score_percent)` for this topic
    - If ≥ 90: INSERT INTO `topic_unlocks` ON CONFLICT DO NOTHING
    - If newly inserted: notify user "🔓 {topic.title} mavzusi ochildi!"
  - **Section unlock**: check if any section has `unlock_required_section = this_topic's section`
    - Calculate `AVG(MAX(score_percent) per topic)` across all topics in the prerequisite section
    - If ≥ 90: INSERT INTO `section_unlocks` ON CONFLICT DO NOTHING
    - If newly inserted: notify user "🔓 {section.title} bo'limi ochildi!"

---

## Phase 7 — My Results

> Flow reference: `bot-flow-canvas.html` → Tab 5

- [x] `ResultsModule` in `src/modules/results/`
- [x] Query `test_sessions` JOIN `topics` for current user, ORDER BY `started_at DESC`, LIMIT 20
- [x] Format each result as a text block (name, date in Tashkent timezone, topic, correct/wrong/percent)
- [x] Send as single message (or paginated if needed — start with single)
- [x] Include status label: "✅ Yakunlangan" vs "❌ To'xtatilgan" for abandoned tests
- [x] No buttons in results view — pure text

---

## Phase 8 — Leaderboard

> Flow reference: `bot-flow-canvas.html` → Tab 6

- [x] `LeaderboardModule` in `src/modules/leaderboard/`
- [x] Delete previous leaderboard messages (store message IDs in session or use a fixed set)
- [x] Run ranking query (see `db-design-notes.md` § 4):
  ```sql
  SELECT u.id, u.first_name, u.last_name,
         COUNT(best.topic_id) AS topics_solved,
         ROUND(AVG(best.best_score), 2) AS avg_score
  FROM (
    SELECT user_id, topic_id, MAX(score_percent) AS best_score
    FROM test_sessions WHERE status = 'completed'
    GROUP BY user_id, topic_id
  ) best
  JOIN users u ON u.id = best.user_id
  GROUP BY u.id, u.first_name, u.last_name
  HAVING COUNT(best.topic_id) >= 10
  ORDER BY avg_score DESC
  LIMIT 40;
  ```
- [x] Send top 40 in 4 messages (10 per message, with medal emojis for top 3)
- [x] After all 4 messages, send user's own position:
  - If in top 40: "🎉 Tabriklaymiz! Siz {rank}-o'rindasiz."
  - If not: "Siz top ichiga kirolmadingiz. Siz {rank}-o'rindasiz."
  - To find rank outside top 40: run full ranking query without LIMIT, find user's position

---

## Phase 9 — Guide Module

> Flow reference: `bot-flow-canvas.html` → Tab 7 (Guide)

- [x] `GuideModule` in `src/modules/guide/`
- [x] On button press:
  1. Delete previously sent guide messages (store message IDs in session `guideMsgIds`)
  2. Load all active guide items: `WHERE is_active = true ORDER BY sort_order ASC LIMIT 20`
  3. For each item:
     - `content_type = 'text'` → `sendMessage(body_text)`
     - `content_type = 'video'` → `sendVideo(media_file_id)`
  4. Store new message IDs in session
- [x] Admin guide management: add/edit/reorder/delete guide items (handled in Phase 13 — Admin)

---

## Phase 10 — Support Module

> Flow reference: `bot-flow-canvas.html` → Tab 7 (Support)

### 10.1 User Side
- [x] `SupportModule` in `src/modules/support/`
- [x] On "❓ Yordam" button:
  1. Find or create `support_threads` row for this user (status: open)
  2. Load last 10 `support_messages` for this thread
  3. Format as conversation history: `[You] ...` / `[Admin] ...`
  4. Send intro + history message
  5. Set `session.supportState = 'waiting_message'`
- [x] While `supportState = 'waiting_message'`, route all text input to support:
  1. Insert into `support_messages` (sender_type=`user`, sender_id=telegram_id, body_text)
  2. Update `support_threads.updated_at`
  3. Forward message to all online admins (or all approved admins) with "💬 Javob berish" inline button
  4. Reply to user: "✅ Xabaringiz yuborildi."
- [x] User can press `⬅️ Orqaga` or any main menu button to exit support mode

### 10.2 Admin Side (Support Forwarding)
- [x] Forward user messages to all approved admins in their admin bot session
- [x] Show user's name + Telegram ID + message text + `💬 Javob berish` button
- [x] `callback_data: 'support:claim:{threadId}'`:
  - Atomic claim: `UPDATE support_threads SET claimed_by = adminId WHERE id = threadId AND claimed_by IS NULL`
  - If affected rows = 1: admin is now owner, prompt for reply
  - If affected rows = 0: "Bu xabar boshqa admin tomonidan olingan."
- [x] Admin reply: insert `support_messages` (sender_type=`admin`), forward to user via `sendMessage(userTelegramId, ...)`
- [x] Super admin can reassign: no `claimed_by IS NULL` check

---

## Phase 11 — Admin Panel

> Flow reference: `bot-flow-canvas.html` → Tab 8

### 11.1 Admin Login Flow
- [x] `AdminModule` in `src/modules/admin/`
- [x] `/admin` command handler:
  - If Telegram ID matches `SUPER_ADMIN_TG_ID` in env: special super admin onboarding
  - If already an approved admin: show admin panel directly
  - Else: ask for password (set `session.adminState = 'awaiting_password'`)
- [x] Password handler (when `adminState = 'awaiting_password'`):
  - Load `admin_shared_password` from `settings`
  - `bcrypt.compare(input, hash)`
  - If correct:
    - Insert into `admins` (role=`regular`, is_approved=`false`)
    - Notify super admin of new request
    - Set `adminState = null`
    - Reply: "⏳ Parol to'g'ri. Bosh admin tasdiqlashini kuting..."
  - If wrong:
    - Increment `failed_attempt_count`
    - If count ≥ 3: set `is_blocked = true`, reply: "🚫 Siz bloklandingiz."
    - Else: reply: "❌ Noto'g'ri parol. {3 - count} ta urinish qoldi."

### 11.2 Super Admin First-Time Setup
- [x] If `SUPER_ADMIN_TG_ID` is set and admin sends `/admin`:
  - If no `admins` row for this telegram_id: create one with `role=super, is_approved=true`
  - If `super_admin_password` in `settings` is empty: prompt to set own password
- [x] Password set handler:
  - Hash with bcrypt, upsert into `settings WHERE key = 'super_admin_password'`
  - Also prompt to set `admin_shared_password` (shared with regular admins)

### 11.3 Admin Approval (Super Admin)
- [x] Inline button to super admin: `[✅ Tasdiqlash] [❌ Rad etish]` for each pending admin
- [x] `callback_data: 'admin:approve:{adminId}'`:
  - `UPDATE admins SET is_approved = true`
  - Notify the admin user: "✅ Siz admin sifatida tasdiqlandi!" + show admin panel
- [x] `callback_data: 'admin:reject:{adminId}'`:
  - Delete admin row
  - Optionally notify the user

### 11.4 Admin Panel Reply Keyboard
- [x] Regular admin keyboard (6 buttons, 2 per row):
  ```
  [📝 Test qo'shish] [✏️ Tahrirlash]
  [📊 Statistika]    [💬 Xabarlar]
  [📖 Qo'llanma]     [📢 E'lon]
  ```
- [x] Super admin keyboard (same + extra row):
  ```
  [⚙️ Sozlamalar]
  ```
- [x] Detect admin role from `admins.role` and render correct keyboard

---

## Phase 12 — Content Management (Admin)

### 12.1 Section CRUD
- [x] Add section: prompt title → parent selection (root or existing section) → sort_order → lock settings
- [x] Edit section: select section → change title/sort_order/lock config
- [x] Delete section (soft): `is_deleted = true` — hide from users but preserve FK integrity
- [x] Warn if deleting section with existing topics/questions

### 12.2 Topic CRUD
- [x] Add topic: select parent section → enter title → configure:
  - `time_per_question_sec` (inline keyboard: 5s, 10s, 15s, 20s, 25s, 30s, 45s, 60s)
  - `options_count` (inline keyboard: 3 or 4)
  - `daily_attempt_limit` (default 3, inline keyboard: 1–5)
  - `is_locked_by_default` (yes/no)
  - If locked: select prerequisite topic
- [x] Edit topic: update any field above
- [x] Delete topic (soft)

### 12.3 Question CRUD (Manual)
- [x] Add question flow:
  1. Select section → select topic
  2. Send question content: text, image, audio, or video
  3. For media: store `media_file_id` from the received message
  4. Send answer options one by one (up to `options_count`)
  5. First option sent = correct answer (tell admin this explicitly)
  6. Confirm and save
- [x] Edit question: change body or media
- [x] Delete question (soft-delete)
- [x] Reorder questions: change `sort_order`

### 12.4 Bulk Import (Excel/CSV)
- [x] Admin uploads `.xlsx` or `.csv` file
- [x] Parse with `exceljs` (xlsx) or `papaparse` (csv)
- [x] Expected columns: `Question | CorrectAnswer | Option2 | Option3 | Option4?`
  - If 3-option topic: 4 columns total
  - If 4-option topic: 5 columns total
- [x] Validate: non-empty question, at least 1 correct answer, correct option count
- [x] Import: insert questions + answer_options in transaction
- [x] Report: "✅ {n} ta savol muvaffaqiyatli yuklandi. ⚠️ {m} ta xato (skip qilindi)."

### 12.5 Admin Guide Management
- [x] View current guide items (ordered list)
- [x] Add item: text or video (upload media → get file_id)
- [x] Delete item: select by sort_order
- [x] Reorder: reassign sort_order values
- [x] Max 20 items enforced with error message

---

## Phase 13 — Announcements

> Flow reference: `bot-flow-canvas.html` → Tab 8 (E'lon)

- [x] Admin presses "📢 E'lon" → prompt: "E'lon matnini yoki mediasini yuboring:" + Cancel button
- [x] Accept text or image/video/file
- [x] Show preview + confirm: "Barcha foydalanuvchilarga yuborilsinmi? ({count} ta)" + `[✅ Ha, yuborish] [❌ Bekor]`
- [x] On confirm:
  - Insert into `announcements` with `expires_at = NOW() + 24 hours`
  - Start broadcast loop: send to all `users WHERE is_blocked = false AND registration_state = 'confirmed'`
  - Handle `TelegramError 403` (user blocked bot): mark user as `is_blocked = true` or skip
  - Rate limit: respect Telegram's 30 msg/sec limit → batch with delay
  - Report final: "✅ {sent} ta yetkazildi. ⚠️ {failed} ta bloklangan."
- [x] Auto-deletion after 24h: on next announcement request or on-schedule, delete expired announcement messages from all users (store message IDs in `announcements` table or separate table)

---

## Phase 14 — Statistics (Admin)

- [x] Admin presses "📊 Statistika" → inline keyboard: `[📥 Excel yuklab olish] [⬅️ Orqaga]`
- [x] Generate Excel file using `exceljs` with 3 sheets:
  - **Sheet 1 — Umumiy**: total users, today's registrations, today's active users, total test sessions, today's test sessions
  - **Sheet 2 — Mavzular**: top 10 most attempted, top 10 least attempted, top 10 hardest (lowest avg score), top 10 easiest
  - **Sheet 3 — Foydalanuvchilar**: all users with full name, avg score, total results count
- [x] Send file as document: `statistics_{YYYY-MM-DD}.xlsx`

---

## Phase 15 — Super Admin Settings

- [x] **Adminlar ro'yxati**: list all admins with name, role, is_approved, is_blocked
- [x] **Admin qo'shish**: super admin manually approves a user by Telegram ID
- [x] **Parolni o'zgartirish**: update `admin_shared_password` (bcrypt hash) in `settings`
- [x] **Bloklangan adminlar**: list blocked admins → `[🔓 Blokdan chiqarish]` button each
  - On unblock: `UPDATE admins SET is_blocked = false, failed_attempt_count = 0`
- [x] **Super admin password change**: update `super_admin_password` in settings

---

## Phase 16 — Testing

### 16.1 Unit Tests
- [x] `UsersService` — registration state machine transitions
- [x] `TestService` — score calculation, daily limit check
- [x] `ContentService` — lock condition evaluation
- [x] `LeaderboardService` — ranking query with test data
- [x] Validation helpers — name validator, script detector
- [x] `getTashkentDate()` — timezone conversion

### 16.2 Integration Tests
- [x] Registration flow end-to-end (mock grammY, real DB)
- [x] Full test session: start → 10 questions → complete → result
- [x] Unlock trigger: score 90% → topic_unlocks row inserted
- [x] Daily limit: 3rd attempt succeeds, 4th blocked
- [x] Admin login: correct password → approved; 3 wrong → blocked

### 16.3 Manual QA Checklist
- [x] Paste `db-design.dbml` into dbdiagram.io — all FKs render correctly
- [x] Register a new user → check `users.registration_state = 'confirmed'`
- [x] Start + complete a test → verify `test_sessions`, `test_answers`, `daily_attempt_counts`
- [x] Attempt 4th test on same topic same day → blocked
- [x] Complete topic at 90%+ → `topic_unlocks` inserted → dependent topic shows 🔓
- [x] Soft-delete a question → existing `test_answers` still readable via snapshots
- [x] Admin approval flow → `is_approved` starts false, super admin sets true
- [x] 3 wrong admin passwords → `is_blocked = true`
- [x] Support thread claiming → second admin gets "Bu xabar olingan" message
- [x] Broadcast 5 test users → all receive announcement
- [x] Download Excel → verify 3 sheets with correct data

---

## Phase 17 — Production Deployment

### 17.1 Webhook Setup
- [x] Configure webhook mode (vs polling) via env `NODE_ENV=production`
- [x] `BotService.onModuleInit()`: call `bot.api.setWebhook(url, { secret_token })` in production
- [x] NestJS HTTP endpoint `POST /bot/webhook` → forward updates to grammY
- [x] Validate `X-Telegram-Bot-Api-Secret-Token` header

### 17.2 Docker Production
- [x] Write `Dockerfile` (multi-stage: builder → runner, Node 20 Alpine)
- [x] Write `docker-compose.prod.yml`:
  - `app` service (bot + NestJS)
  - `postgres:16-alpine` with named volume
  - `nginx` reverse proxy (optional, for webhook SSL termination)
- [x] `.dockerignore` — exclude `node_modules`, `.env`, `dist`

### 17.3 Health & Observability
- [x] `/health` HTTP endpoint returning `{ status: 'ok', db: 'connected', bot: 'running' }`
- [x] Structured JSON logging via `nest-winston` or `pino`
- [x] Error alerting: uncaught exceptions → notify super admin via Telegram message
- [x] Track key metrics: active sessions, daily test count, error rate (simple counters in DB or `settings` table)

### 17.4 Database Production
- [x] Run `knex migrate:latest` as part of Docker `CMD` or separate migration job
- [x] Set up daily `pg_dump` backup script
- [x] Configure `DATABASE_POOL_MIN=2 DATABASE_POOL_MAX=10` for production load

### 17.5 Deployment (recommended: Fly.io or Railway)
- [x] Create `fly.toml` or Railway config
- [x] Set all env vars in platform secrets
- [x] First deploy: run migrations, verify bot responds to `/start`
- [x] Set up auto-deploy from `main` branch via GitHub Actions

---

## File Layout

```
src/
├── config/
│   └── configuration.ts            # Typed env config + Joi validation
├── database/
│   ├── database.module.ts
│   ├── knex.provider.ts
│   └── repositories/
│       ├── base.repository.ts
│       ├── users.repository.ts
│       ├── admins.repository.ts
│       ├── sections.repository.ts
│       ├── topics.repository.ts
│       ├── questions.repository.ts
│       ├── answer-options.repository.ts
│       ├── test-sessions.repository.ts
│       ├── test-answers.repository.ts
│       ├── daily-attempt-counts.repository.ts
│       ├── support-threads.repository.ts
│       ├── support-messages.repository.ts
│       ├── guide-items.repository.ts
│       ├── announcements.repository.ts
│       ├── stickers.repository.ts
│       ├── settings.repository.ts
│       ├── topic-unlocks.repository.ts
│       └── section-unlocks.repository.ts
├── bot/
│   ├── bot.module.ts
│   ├── bot.service.ts              # grammY Bot instance, start/stop
│   ├── context.type.ts             # MyContext + SessionData types
│   └── middleware/
│       ├── logging.middleware.ts
│       ├── user-hydration.middleware.ts
│       ├── block-check.middleware.ts
│       ├── registration-guard.middleware.ts
│       └── active-test-guard.middleware.ts
├── common/
│   ├── helpers/
│   │   ├── tashkent-date.ts
│   │   ├── keyboard.ts
│   │   └── format.ts
│   └── constants/
│       ├── callback-data.ts
│       ├── states.ts
│       └── limits.ts
└── modules/
    ├── users/
    ├── admin/
    ├── content/                    # sections + topics browser
    ├── test/
    ├── results/
    ├── leaderboard/
    ├── guide/
    ├── support/
    ├── announcements/
    └── statistics/
migrations/
seeds/
test/
docs/
  ├── bot-doc.pdf
  ├── db-design.dbml
  ├── db-design-notes.md
  └── bot-flow-canvas.html
knexfile.ts
docker-compose.dev.yml
docker-compose.prod.yml
Dockerfile
Makefile
plan.md                             ← you are here
```

---

## Implementation Order (Recommended)

```
Phase 0  →  Phase 1  →  Phase 2  →  Phase 3  →  Phase 4
   ↓
Phase 5  →  Phase 6  →  Phase 7  →  Phase 8
   ↓
Phase 11 →  Phase 12 →  Phase 13 →  Phase 14 →  Phase 15
   ↓
Phase 9  →  Phase 10 →  Phase 16 →  Phase 17
```

> Start with Phases 0–6 to get a working bot loop (register → browse → take tests → see results).
> Then add admin tools (Phases 11–15).
> End with testing and deployment (Phases 16–17).
> Then add the web admin panel (Phases 18–20).

---

## Phase 18 — Monorepo Restructuring

> **Context**: The project becomes a monorepo to host both the NestJS bot (`apps/bot/`) and the React web admin panel (`apps/web/`), with shared TypeScript types in `packages/shared-types/`.

### 18.1 npm Workspaces Setup
- [x] Add root `package.json` with `"workspaces": ["apps/*", "packages/*"]`
- [x] Move all bot files from project root into `apps/bot/`:
  - `src/` → `apps/bot/src/`
  - `knexfile.ts` → `apps/bot/knexfile.ts`
  - `migrations/` → `apps/bot/migrations/`
  - `seeds/` → `apps/bot/seeds/`
  - `apps/bot/package.json` (name: `@arab-tili/bot`)
- [x] Update `apps/bot/tsconfig.json` path aliases to reflect new root
- [x] Update `Makefile` — all targets now cd into `apps/bot/`
- [x] Update `docker-compose.dev.yml` — `build: { context: apps/bot }`
- [x] Update `Dockerfile` — multi-stage build now references `apps/bot/` and `apps/web/`

### 18.2 Shared Types Package
- [x] Create `packages/shared-types/package.json` (name: `@arab-tili/shared-types`, no runtime deps)
- [x] Create `packages/shared-types/src/index.ts` — export all DTO interfaces shared between bot API and web:
  ```typescript
  AdminDTO, SectionDTO, TopicDTO, QuestionDTO, AnswerOptionDTO,
  UserDTO, SupportThreadDTO, SupportMessageDTO, GuideItemDTO,
  AnnouncementDTO, DashboardStatsDTO, JwtPayload
  ```
- [x] Add `"@arab-tili/shared-types": "*"` as dependency in both `apps/bot/package.json` and `apps/web/package.json`

---

## Phase 19 — NestJS REST API Layer

> All endpoints under `/api/**`. The same NestJS process serves both the grammY bot and the REST API. Bot webhook/polling runs on the same port.

### 19.1 Auth Infrastructure
- [x] Install: `@nestjs/jwt` `@nestjs/passport` `passport` `passport-jwt` `@types/passport-jwt`
- [x] Create `WebAuthModule` (`apps/bot/src/modules/web-auth/`)
- [x] `OtpService` — in-memory Map store for 6-digit codes:
  ```typescript
  interface OtpEntry {
    adminId: number;
    telegramId: bigint;
    role: 'super' | 'regular';
    expiresAt: Date;        // now + 15_000ms
    used: boolean;
  }
  generate(admin): string   // random 6-digit string, stored in Map
  consume(code): OtpEntry | null  // validates: exists, not used, not expired → marks used=true
  // setInterval every 60s: prune expired entries from Map
  ```
- [x] `JwtStrategy` — `passport-jwt` Bearer strategy; loads admin row from DB via `payload.sub`
- [x] `AdminJwtGuard` — applies JWT auth to all `/api/**` routes (except `/api/auth/otp`)
- [x] `SuperAdminGuard` — checks `payload.role === 'super'`; applied on `/api/admins` and `/api/settings`
- [x] Configure CORS in `main.ts`: allow `http://localhost:5173` (dev) and production domain
- [x] Set up `@nestjs/swagger` at `/api/docs` (disabled in production)

### 19.2 Bot Command: `/weblogin`
- [x] Handler in `WebAuthModule` — only accessible to approved, non-blocked admins
- [x] Calls `OtpService.generate(admin)` → gets code
- [x] Sends message with monospace code (Markdown parse mode):
  ```
  🔐 Web panel uchun kodingiz:
  `123456`
  ⏰ Bu kod 15 soniya ichida kiritilishi kerak.
  ```

### 19.3 Auth Controller (`POST /api/auth/otp`, `GET /api/auth/me`)
- [x] `POST /api/auth/otp` — public:
  - `OtpService.consume(code)` → null = 401 "Kod noto'g'ri yoki muddati o'tgan"
  - Valid → `JwtService.sign({ sub, telegramId, role }, { expiresIn: '8h' })`
  - Returns `{ accessToken, role, expiresAt }`
- [x] `GET /api/auth/me` — protected: returns current admin DTO

### 19.4 Sections API (`/api/sections`)
- [x] `GET /api/sections` — flat list, `?includeDeleted=false`
- [x] `GET /api/sections/tree` — nested `{ id, title, children[] }` structure
- [x] `POST /api/sections` — create; validate: title required, parentId valid if provided
- [x] `PATCH /api/sections/:id` — partial update any field
- [x] `DELETE /api/sections/:id` — soft delete (`is_deleted = true`)
- [x] `PATCH /api/sections/reorder` — body: `[{ id, sortOrder }]`

### 19.5 Topics API (`/api/topics`)
- [x] `GET /api/topics?sectionId=` — list with `questionCount` aggregate
- [x] `POST /api/topics` — create; validate: sectionId, options_count ∈ {3,4}, time_per_question_sec ∈ {5,10,15,20,25,30,45,60}
- [x] `PATCH /api/topics/:id` — partial update
- [x] `DELETE /api/topics/:id` — soft delete
- [x] `PATCH /api/topics/reorder` — body: `[{ id, sortOrder }]`

### 19.6 Questions API (`/api/questions`)
- [x] `GET /api/questions?topicId=` — paginated (`?page=1&limit=20`) with nested options
- [x] `POST /api/questions` — create question + options in transaction; validate exactly 1 `isCorrect`
- [x] `PATCH /api/questions/:id` — update body/media
- [x] `DELETE /api/questions/:id` — soft delete
- [x] `POST /api/questions/bulk-import` — `multipart/form-data` file upload:
  - Parse `.xlsx` with `exceljs`, `.csv` with `papaparse`
  - Columns: `Question | CorrectAnswer | Option2 | Option3 | Option4?`
  - Run in transaction; return `{ imported, failed, errors[] }`
- [x] `PATCH /api/answer-options/:id` — update single option

### 19.7 Users API (`/api/users`)
- [x] `GET /api/users` — paginated; `?page&limit&search&isBlocked`
- [x] `GET /api/users/:id/results` — last 20 test sessions for a user
- [x] `PATCH /api/users/:id/block` — toggle `is_blocked`

### 19.8 Admins API (`/api/admins`) — super admin only
- [x] `GET /api/admins` — all admins with status
- [x] `PATCH /api/admins/:id/approve` — set approved; notify user via bot
- [x] `PATCH /api/admins/:id/reject` — delete row
- [x] `PATCH /api/admins/:id/block` — toggle blocked, reset failed_attempt_count

### 19.9 Statistics API (`/api/statistics`)
- [x] `GET /api/statistics/overview` — `DashboardStatsDTO`
- [x] `GET /api/statistics/export` — stream `.xlsx` file
- [x] `GET /api/statistics/leaderboard` — top 40 with user details

### 19.10 Guide API (`/api/guide`)
- [x] `GET /api/guide` — all items ordered by sort_order
- [x] `POST /api/guide` — create item
- [x] `PATCH /api/guide/:id` — update
- [x] `DELETE /api/guide/:id` — hard delete (guide items aren't referenced by FKs)
- [x] `PATCH /api/guide/reorder` — body: `[{ id, sortOrder }]`

### 19.11 Announcements API (`/api/announcements`)
- [x] `GET /api/announcements` — list with expired flag computed at query time
- [x] `POST /api/announcements` — insert + trigger async broadcast via bot
- [x] `GET /api/announcements/:id/stats` — delivery counts

### 19.12 Support API (`/api/support`)
- [x] `GET /api/support/threads` — paginated, `?status=open|claimed|closed`
- [x] `GET /api/support/threads/:id/messages` — full message history
- [x] `POST /api/support/threads/:id/messages` — admin reply; deliver to user via `bot.api.sendMessage()`
- [x] `PATCH /api/support/threads/:id/claim` — atomic claim (WHERE claimed_by IS NULL; super admin bypasses)
- [x] `PATCH /api/support/threads/:id/close` — set status = closed

### 19.13 Settings API (`/api/settings`) — super admin only
- [x] `GET /api/settings` — `{ adminSharedPasswordSet: boolean, superAdminPasswordSet: boolean }`
- [x] `PATCH /api/settings/admin-password` — bcrypt hash new password → upsert in settings table
- [x] `PATCH /api/settings/super-password` — same for super admin password

---

## Phase 20 — Web Admin Panel (React + Vite + shadcn/ui)

> **Stack**: React 18 + Vite + TypeScript · shadcn/ui · Tailwind CSS · TanStack Query · React Router v6 · Axios · dnd-kit · recharts

### 20.1 Project Setup (`apps/web/`)
- [x] `npm create vite@latest . -- --template react-ts`
- [x] Install runtime deps:
  `react-router-dom@6` `axios` `@tanstack/react-query` `@tanstack/react-query-devtools`
  `lucide-react` `recharts` `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities`
  `react-hook-form` `@hookform/resolvers` `zod` `date-fns`
- [x] Install and init Tailwind: `tailwindcss` `postcss` `autoprefixer`
- [x] Install and init shadcn/ui: `npx shadcn@latest init` (New York style, slate base color)
- [x] Add shadcn/ui components: `button` `input` `card` `table` `dialog` `dropdown-menu` `badge`
  `alert` `tabs` `select` `textarea` `sheet` `separator` `skeleton` `sonner` `collapsible`
- [x] Configure `vite.config.ts`: proxy `/api → http://localhost:3000` in dev mode
- [x] Add `@arab-tili/shared-types` import from workspace

### 20.2 Auth Layer
- [x] `src/lib/auth.ts` — JWT helpers (localStorage get/set/clear, `isTokenValid()` checking exp, `getRole()`)
- [x] `src/lib/api.ts` — Axios instance:
  - `baseURL: '/api'`
  - Request interceptor: inject `Authorization: Bearer <token>`
  - Response interceptor: 401 → `clearToken()` → `navigate('/login')`
- [x] `src/contexts/AuthContext.tsx` — provides `{ admin, role, isLoading, logout }` app-wide

### 20.3 Router & Layout
- [x] `src/router.tsx` — React Router v6 routes with `<ProtectedRoute>` and `<SuperAdminRoute>` wrappers
- [x] `src/components/layout/AppLayout.tsx` — sidebar + topbar shell
- [x] `src/components/layout/Sidebar.tsx` — nav links filtered by `role`; active state highlighting
- [x] `src/components/layout/Header.tsx` — current admin name + logout button

### 20.4 Login Page (`/login`)
- [x] Centered card with bot logo
- [x] Instruction text: send `/weblogin` in bot → enter 6-digit code
- [x] Single 6-digit OTP input (number-only, auto-submit on 6th digit)
- [x] Loading + error states; "Kod 15 soniya amal qiladi" hint text
- [x] On success: `setToken(accessToken)` → `navigate('/')`

### 20.5 Dashboard (`/`)
- [x] 4 stat cards: Total Users | Today Registered | Total Test Sessions | Today Sessions
- [x] Open support threads table (up to 5 rows) with "View All" link
- [x] Quick action buttons: Content, Users, Support

### 20.6 Content Page (`/content`)
- [x] Split layout: left 1/3 = section tree, right 2/3 = topic table
- [x] **Section tree** (dnd-kit for reorder within same parent):
  - Collapsible nodes, indent per level
  - Each node: title, lock badge, Edit, Delete, Add Child buttons
  - "➕ Root Section" button at top
- [x] **Topic table** (visible after selecting a section):
  - Columns: Title | Questions | Time/Q | Options | Daily Limit | Lock | Actions
  - "➕ Add Topic" + drag handles for reorder
  - "📝 Questions" button → navigate to `/questions/:topicId`
- [x] **Section/Topic form Dialog** (shared, controlled by `mode='section'|'topic'`):
  - Title, description, sort_order
  - Lock toggle → prerequisite picker (shadcn Select with full section/topic list)
  - Topic extras: time (5–60s select), options count (3 or 4), daily limit

### 20.7 Questions Page (`/questions/:topicId`)
- [x] Breadcrumb from API: `SectionName > TopicName > Questions`
- [x] Toolbar: "➕ Add" | "📥 Bulk Import" | topic config summary chips
- [x] Paginated question cards (20/page):
  - Question text (truncated) + media type badge
  - Answer options listed — correct one highlighted with green badge
  - Drag handle + Edit + Delete actions
- [x] **Question form Dialog**:
  - Textarea (optional) + media type select + file_id input (optional; at least one required)
  - `n` answer option inputs; radio button for correct; validation via zod
- [x] **Bulk Import Sheet (right-side drawer)**:
  - "Download Template" button → generates and downloads empty `.xlsx`
  - File drop zone (`.xlsx` / `.csv`)
  - Preview table of parsed rows with per-row validation badges
  - Import button → progress indicator → result summary

### 20.8 Users Page (`/users`)
- [x] Paginated data table with search (by name or Telegram ID) and filter (All/Active/Blocked)
- [x] Columns: Full Name | Telegram ID | Joined | Status (badge) | Actions
- [x] Row actions: "View Results" (opens Sheet with last 20 test sessions) | Block/Unblock (with confirm dialog)

### 20.9 Admins Page (`/admins`) — super admin only
- [x] Pending section at top (highlighted alert): list of unapproved admins with Approve/Reject
- [x] Full table: Name/TgID | Role badge | Approved | Blocked | Joined | Actions
- [x] Block/Unblock confirmation dialog

### 20.10 Statistics Page (`/statistics`)
- [x] Stat cards + charts (recharts):
  - Line chart: daily user registrations (last 30 days)
  - Bar chart: daily test sessions (last 30 days)
- [x] Leaderboard table: rank, name, avg score, topics solved
- [x] "📥 Download Excel" → `GET /api/statistics/export` → `<a download>` trigger

### 20.11 Guide Page (`/guide`)
- [x] Drag-to-reorder list (dnd-kit); auto-PATCH on drop
- [x] Each item: content type badge + text preview or video file_id + active toggle + Edit + Delete
- [x] "➕ Add Item" Dialog: type selector → textarea (text) or file_id input (video); max 20 items enforced

### 20.12 Announcements Page (`/announcements`)
- [x] "📢 Create" button → Dialog: text area + media type + file_id + preview + "Send to {n} users" confirm
- [x] Table: date | preview | expired badge | sent/failed counts
- [x] Poll `/api/announcements/:id/stats` every 2s while broadcast is in progress

### 20.13 Support Page (`/support`)
- [x] Two-panel layout: thread list left, message panel right
- [x] Thread list: status filter tabs (Open / Claimed / Closed / All), search by user name
- [x] Each thread: user name, message preview, time, status badge; click → load messages
- [x] Message panel: scrollable history with user (left/gray) and admin (right/blue) bubbles
- [x] Bottom: text input + Send; "Claim" button (unclaimed only); "Close Thread" button
- [x] Poll messages every 5s while a thread is open

### 20.14 Settings Page (`/settings`) — super admin only
- [x] Card: Change Admin Shared Password (new + confirm inputs + Save; shows success toast)
- [x] Card: Change Super Admin Password (same)
- [x] Card: Bot info (masked token, read-only)

### 20.15 Production Build & Serving
- [x] `apps/web/vite.config.ts` — `build.outDir = '../bot/public'` (output into bot's static folder)
- [x] `apps/bot/src/main.ts` — `app.useStaticAssets(join(__dirname, '..', 'public'))` + SPA catch-all for non-API routes
- [x] `Dockerfile` — stage 1: build web → stage 2: build bot → stage 3: runner copies both artifacts
- [x] CI/CD: add `npm run build --workspace=apps/web` step before bot build

---

## Updated File Layout (Monorepo)

```
test-bot/                            ← monorepo root
├── apps/
│   ├── bot/                         ← NestJS + grammY (Phases 0–17)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── bot/
│   │   │   ├── database/
│   │   │   ├── common/
│   │   │   └── api/                 ← REST controllers (Phase 19)
│   │   │       ├── auth/
│   │   │       ├── sections/
│   │   │       ├── topics/
│   │   │       ├── questions/
│   │   │       ├── users/
│   │   │       ├── admins/
│   │   │       ├── statistics/
│   │   │       ├── guide/
│   │   │       ├── announcements/
│   │   │       ├── support/
│   │   │       └── settings/
│   │   ├── public/                  ← built web panel output (gitignored)
│   │   ├── migrations/
│   │   ├── seeds/
│   │   ├── knexfile.ts
│   │   └── package.json
│   └── web/                         ← React + Vite admin panel (Phase 20)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   └── auth.ts
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx
│       │   ├── components/
│       │   │   └── layout/
│       │   ├── pages/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── ContentPage.tsx
│       │   │   ├── QuestionsPage.tsx
│       │   │   ├── UsersPage.tsx
│       │   │   ├── AdminsPage.tsx
│       │   │   ├── StatisticsPage.tsx
│       │   │   ├── GuidePage.tsx
│       │   │   ├── AnnouncementsPage.tsx
│       │   │   ├── SupportPage.tsx
│       │   │   └── SettingsPage.tsx
│       │   └── router.tsx
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── shared-types/
│       ├── src/
│       │   └── index.ts             ← shared DTOs + JwtPayload
│       └── package.json
├── docs/
├── plan.md
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Dockerfile
├── Makefile
└── package.json                     ← workspace root
```

---

## Auth Flow

```
Admin in Telegram           Bot                 Web Browser              NestJS API
       │                     │                       │                       │
       │── /weblogin ────────►│                       │                       │
       │                     │──── OtpService.generate() ──────────────────►(Map)
       │◄── "Kodingiz: 123456"│                       │                       │
       │                     │                       │                       │
       │                     │       open browser    │                       │
       │────────────────────────────enter "123456" ──►│                       │
       │                     │                       │── POST /api/auth/otp──►│
       │                     │                       │                       │── consume(code)
       │                     │                       │                       │── sign JWT {8h}
       │                     │                       │◄── { accessToken } ───│
       │                     │                       │── localStorage.set()  │
       │                     │                       │── navigate('/') ──────►
       │                     │           (8h later)  │                       │
       │                     │                       │── any request ────────►│
       │                     │                       │◄── 401 ───────────────│
       │                     │                       │── clearToken()        │
       │                     │                       │── navigate('/login')  │
```

---

*Last updated: 2026-02-23*
