# DB Design Notes — Arab Tili Yordamchi Bot

## Table Summary (18 tables total)

| # | Table | Purpose |
|---|-------|---------|
| 1 | `settings` | Global key-value config (passwords as bcrypt hashes) |
| 2 | `stickers` | Pool of Telegram sticker file_ids for correct/wrong feedback |
| 3 | `users` | Telegram users with registration state machine |
| 4 | `admins` | Admin accounts (super/regular) with approval + block tracking |
| 5 | `sections` | Infinitely nested content hierarchy (self-referential) |
| 6 | `section_unlocks` | Immutable per-user section unlock records |
| 7 | `topics` | Leaf nodes (test topics) with time/options/limit config |
| 8 | `topic_unlocks` | Immutable per-user topic unlock records |
| 9 | `questions` | Questions with optional media (image/audio/video) |
| 10 | `answer_options` | 3 or 4 options per question, one correct |
| 11 | `test_sessions` | One row per test attempt with final score |
| 12 | `test_answers` | Per-question answer with text snapshots for permanence |
| 13 | `daily_attempt_counts` | 3/day limit enforced via UPSERT + date column |
| 14 | `support_threads` | Support conversation per user, claimable by admin |
| 15 | `support_messages` | Messages in support thread |
| 16 | `guide_items` | Up to 20 ordered guide items (text or video) |
| 17 | `announcements` | Admin broadcasts with 24h auto-expiry |

---

## Key Design Decisions

### 1. Result Permanence via Soft Delete + Snapshots

Questions and answer options are **soft-deleted** (`is_deleted = true`) rather than physically removed. This preserves FK integrity.

`test_answers` additionally stores **text snapshots** at the moment of answering:
- `question_snapshot` — copy of `questions.body_text`
- `chosen_option_text` — copy of the selected option's `body_text`
- `correct_option_text` — copy of the correct option's `body_text`

This means **historical results remain readable** even if questions are later deleted or edited. The spec explicitly requires: *"O'chirilgan testlarning natijalari ham serverda saqlanib qoladi"*.

### 2. Lock System Architecture

Lock conditions are stored as **nullable self-referential FKs**:

```
sections.unlock_required_section  → sections.id
topics.unlock_required_topic      → topics.id
```

When a section/topic is `is_locked_by_default = true` and `unlock_required_*` is set, the application checks whether the prerequisite's threshold is met for the current user.

The unlock calculation:
- **Topic unlock**: `MAX(score_percent) >= 90` from `test_sessions` for the prerequisite topic
- **Section unlock**: `AVG(MAX(score_percent) per topic)` >= 90 across all topics in the prerequisite section

Once the threshold is met, a row is inserted into `topic_unlocks` or `section_unlocks`. These tables are **never deleted from** — the spec says: *"bir marta ochilsa — qayta qulflanmaydi"*.

### 3. Daily Attempt Tracking

Two mechanisms work together:

**`daily_attempt_counts`** — UPSERT pattern:
```sql
INSERT INTO daily_attempt_counts (user_id, topic_id, attempt_date, count)
VALUES ($userId, $topicId, current_date_tashkent, 1)
ON CONFLICT (user_id, topic_id, attempt_date)
DO UPDATE SET count = daily_attempt_counts.count + 1;
```

**`test_sessions.attempt_date_tashkent`** — Denormalized copy of the Tashkent date at session start. This avoids timezone re-computation in queries.

Tashkent date computation (UTC+5):
```typescript
// In application code:
const tashkentDate = new Date(Date.now() + 5 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0]; // 'YYYY-MM-DD'
```

No cron job is needed — the date column provides natural daily isolation.

### 4. Leaderboard Query

Top 40 users who solved 10+ topics, ranked by average of best scores:

```sql
SELECT
  u.id,
  u.first_name,
  u.last_name,
  COUNT(best.topic_id)           AS topics_solved,
  ROUND(AVG(best.best_score), 2) AS avg_score
FROM (
  SELECT
    user_id,
    topic_id,
    MAX(score_percent) AS best_score
  FROM test_sessions
  WHERE status = 'completed'
  GROUP BY user_id, topic_id
) best
JOIN users u ON u.id = best.user_id
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(best.topic_id) >= 10
ORDER BY avg_score DESC
LIMIT 40;
```

Supported by the composite index `idx_test_sessions_best_score` on `(user_id, topic_id, score_percent)`.

### 5. Admin Approval Flow

```
User types /admin
  → enters shared password (settings WHERE key = 'admin_shared_password')
      ├── correct → INSERT admins (telegram_id, role='regular', is_approved=false)
      │             → notify super admin → super admin approves/rejects
      └── wrong   → failed_attempt_count++
                    → if count >= 3: is_blocked = true
```

Super admin unblocks: `UPDATE admins SET is_blocked = false, failed_attempt_count = 0`.

Super admin's own password is stored separately: `settings WHERE key = 'super_admin_password'`.

### 6. Support Thread Claiming (atomic)

```sql
-- First admin to respond claims it atomically:
UPDATE support_threads
SET claimed_by = $adminId, status = 'claimed', updated_at = now()
WHERE id = $threadId AND claimed_by IS NULL;
```

Super admin reassignment:
```sql
UPDATE support_threads
SET claimed_by = $newAdminId, updated_at = now()
WHERE id = $threadId;
-- No WHERE claimed_by IS NULL check — super admin can always override
```

### 7. Test Session Lifecycle

```
[in_progress] → user answers all questions → [completed]
             → user presses "To'xtatish" → confirms → [abandoned]
             → bot crashes / user blocks bot → [abandoned] (cleanup job or on-reconnect)
```

On abandon: unanswered `test_answers` rows are created with `chosen_option_id = NULL`, `is_correct = false`.

`wrong_count` includes both wrong answers AND unanswered questions.

### 8. Sections with No Topics / Topics with No Questions

The spec says:
- *"Ichida mavzu yo'q bo'limlar userga ko'rinmaydi"* — sections with no visible topics are hidden
- *"Savoli yo'q mavzular ham userga ko'rinmaydi"* — topics with no questions are hidden

This is enforced at the **application layer** (filtered queries), not at DB level.

---

## Indexes Reference

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `idx_users_telegram_id` | users | telegram_id | unique |
| `idx_admins_telegram_id` | admins | telegram_id | unique |
| `idx_sections_parent_id` | sections | parent_id | btree |
| `idx_sections_parent_order` | sections | (parent_id, sort_order) | btree |
| `idx_topics_section_order` | topics | (section_id, sort_order) | btree |
| `idx_questions_topic_active` | questions | (topic_id, is_deleted) | btree |
| `idx_answer_options_correct` | answer_options | (question_id, is_correct) | btree |
| `uq_section_unlocks_user_section` | section_unlocks | (user_id, section_id) | unique |
| `uq_topic_unlocks_user_topic` | topic_unlocks | (user_id, topic_id) | unique |
| `idx_test_sessions_daily` | test_sessions | (user_id, topic_id, attempt_date_tashkent) | btree |
| `idx_test_sessions_best_score` | test_sessions | (user_id, topic_id, score_percent) | btree |
| `uq_test_answers_session_question` | test_answers | (session_id, question_id) | unique |
| `uq_daily_attempt_counts` | daily_attempt_counts | (user_id, topic_id, attempt_date) | unique |
| `idx_support_threads_user_id` | support_threads | user_id | btree |
| `idx_support_messages_thread_time` | support_messages | (thread_id, sent_at) | btree |
| `idx_guide_items_sort_order` | guide_items | sort_order | btree |
| `idx_announcements_expires_at` | announcements | expires_at | btree |

---

## Settings Keys

| Key | Value | Description |
|-----|-------|-------------|
| `super_admin_password` | bcrypt hash | Super admin sets this on first /admin |
| `admin_shared_password` | bcrypt hash | Shared password for regular admin onboarding |

---

## Verification Checklist

- [ ] Paste `db-design.dbml` into https://dbdiagram.io/d — all 18 tables and FK arrows render correctly
- [ ] Run knex migrations → `\dt` in psql shows all 18 tables
- [ ] Register a user → check `users.registration_state` transitions correctly
- [ ] Start + complete a test → verify rows in `test_sessions`, `test_answers`, `daily_attempt_counts`
- [ ] Attempt a 4th test on same topic same day → blocked by daily limit check
- [ ] Complete a topic at 90%+ → `topic_unlocks` row inserted → dependent topic now accessible
- [ ] Soft-delete a question → existing `test_answers` still queryable via snapshot columns
- [ ] Admin approval flow → `is_approved` starts false, super admin sets true
- [ ] 3 wrong admin passwords → `is_blocked = true`
- [ ] Support thread claiming → second admin cannot claim already-claimed thread
