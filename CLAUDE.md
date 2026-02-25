# Arab Tili Yordamchi Bot — Claude Code Guide

## Project Overview

**Arab Tili Yordamchi Bot** is a Telegram bot that helps users learn Arabic. It is built as an npm workspaces monorepo consisting of:

- `apps/bot` — NestJS 11 + grammY Telegram bot with a REST API (served on the same process)
- `apps/web` — React 19 + Vite admin dashboard
- `packages/shared-types` — Shared TypeScript types used by both apps

**Stack**: NestJS · grammY · PostgreSQL 16 · Knex.js · TypeScript · React · Vite · Tailwind CSS

---

## Monorepo Structure

```
/
├── apps/
│   ├── bot/          # NestJS backend + Telegram bot
│   │   ├── src/
│   │   │   ├── api/          # REST API controllers (for web dashboard)
│   │   │   ├── bot/          # grammY bot setup, middleware, bot.module
│   │   │   ├── common/       # Shared guards, decorators, interceptors
│   │   │   ├── database/     # Knex database module & provider
│   │   │   ├── modules/      # Feature modules (registration, test, guide, etc.)
│   │   │   └── repositories/ # Database repository classes
│   │   ├── migrations/       # Knex migrations
│   │   ├── seeds/            # Knex seed files
│   │   └── test/             # e2e tests
│   └── web/          # React + Vite admin frontend
│       └── src/
│           ├── components/   # Reusable UI components
│           ├── pages/        # Route pages
│           ├── contexts/     # React contexts
│           └── lib/          # Axios client, utilities
└── packages/
    └── shared-types/ # Shared TypeScript interfaces/types
```

---

## Development Commands

All commands are run from the **repo root** unless noted.

### Install dependencies
```bash
npm install
```

### Run both apps in dev mode (concurrently)
```bash
npm run dev
```

### Bot only
```bash
npm run bot:dev    # watch mode
npm run bot:build  # production build
npm run bot:start  # start production
```

### Web only
```bash
npm run web:dev    # Vite dev server
npm run web:build  # production build
```

### Database migrations (Knex)
```bash
npm run migrate          # run latest migrations
npm run migrate:rollback # rollback last batch
npm run seed             # run seeds
```

### Testing (bot workspace)
```bash
# From repo root:
npm run test --workspace=apps/bot          # unit tests
npm run test:e2e --workspace=apps/bot      # e2e tests
npm run test:cov --workspace=apps/bot      # coverage

# Or from apps/bot directly:
cd apps/bot && npx jest
```

### Linting & formatting
```bash
# Bot (ESLint + Prettier):
npm run lint --workspace=apps/bot
npm run format --workspace=apps/bot

# Web (ESLint):
npm run lint --workspace=apps/web
```

---

## Environment Variables

Copy `.env.example` to `.env` inside `apps/bot/`:

```
NODE_ENV=development
BOT_TOKEN=<telegram-bot-token>
SUPER_ADMIN_TG_ID=<your-telegram-id>
DATABASE_URL=postgresql://user:pass@localhost:5432/arab_tili_bot
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
JWT_SECRET=<secret>
WEB_PORT=3001
```

The bot reads `.env` from `apps/bot/` via `dotenv/config` and `@nestjs/config`.

---

## Architecture Notes

### Bot (apps/bot)
- **Framework**: NestJS with a custom grammY integration (`BotModule`)
- **Database**: PostgreSQL accessed via Knex (raw query builder, no ORM)
- **Conversation flows**: `@grammyjs/conversations` for multi-step interactions
- **Path aliases**: `@/` maps to `apps/bot/src/` (configured in `tsconfig.json`)
- **Feature modules**: Each Telegram feature (registration, test, guide, leaderboard, etc.) is its own NestJS module under `src/modules/`
- **REST API**: Additional NestJS controllers under `src/api/` power the web dashboard

### Web (apps/web)
- **Framework**: React 19 with React Router v6
- **Data fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS
- **Build tool**: Vite

### Shared Types (packages/shared-types)
- TypeScript interfaces shared across bot and web workspaces
- Referenced as `@arab-tili/shared-types` in both workspaces

---

## Git Workflow

- **One branch per task** — create a new `claude/<short-description>-<id>` branch at the start of every task. PRs are merged and branches are deleted after each task.
- **Branch naming**: `claude/<kebab-description>-<session-suffix>` (e.g. `claude/fix-support-names-DGIHr`)
- **Always push** the branch and open a PR when the task is done.

---

## Key Conventions

- **TypeScript strict mode** is enabled in both apps
- **No ORM** — all DB queries go through Knex in repository classes (`src/repositories/`)
- **Migrations** use timestamped filenames: `YYYYMMDDHHMMSS_description.ts`
- **Timezone**: All date logic uses Tashkent (UTC+5) via `dayjs`
- **Bot token** must never be committed; always use environment variables
- **Swagger** docs are available at `/api/docs` when the bot server is running

---

## Testing Notes

- Unit tests live alongside source files as `*.spec.ts`
- e2e tests are in `apps/bot/test/` with the `jest-e2e.json` config
- Tests do **not** require a real database connection (mock where needed)
- Run a single test file: `cd apps/bot && npx jest src/modules/test/test.service.spec.ts`
