---
name: project-database
description: "Схема БД PostgreSQL — таблицы users, groups, habits и связанные"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

PostgreSQL на сервере `bot.mihmih.pro`. Подключение через `DATABASE_URL` (SSL).

**Оригинальные таблицы (bot-функциональность), `migrate.js` + `migrate_vk.js`:**
```sql
users          — id, tg_id BIGINT NULL (был NOT NULL, снят в migrate_vk.js), vk_id TEXT,
                 username, first_name, last_name,
                 email TEXT, phone TEXT,
                 avatar_url, health_connected_at TIMESTAMPTZ, created_at
               partial UNIQUE INDEX users_vk_id_unique ON (vk_id) WHERE vk_id IS NOT NULL
groups         — id, name, invite_code UNIQUE, creator_id → users, created_at
group_members  — user_id → users, group_id → groups, joined_at; PK(user_id, group_id)
goals          — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps          — id, user_id → users, goal_id → goals, count, recorded_at
               UNIQUE(user_id, goal_id, recorded_at)
auth_codes     — user_id PK → users, code, expires_at, attempts (legacy, в API не используется)
refresh_tokens — id, user_id → users, token UNIQUE, expires_at, created_at
```

Telegram-пользователи: `tg_id` заполнен, `vk_id` = NULL.
VK-пользователи: `vk_id` заполнен, `tg_id` = NULL.
`groups/group_members/goals/steps` — legacy bot-функциональность шагов; новый функционал привычек живёт в таблицах ниже.

**Таблицы привычек (добавлены позже, migrate_habits.js):**
```sql
habits       — id, creator_id → users, name, category TEXT DEFAULT 'steps',
               type CHECK('solo'|'group') DEFAULT 'group',
               goal_value INT NULL, goal_unit TEXT NULL, notifications BOOL DEFAULT true,
               invite_code TEXT UNIQUE, closed_at, created_at
habit_members — habit_id → habits (ON DELETE CASCADE), user_id → users, joined_at; PK(habit_id, user_id)
habit_logs   — id, habit_id → habits (ON DELETE CASCADE), user_id → users,
               date DATE DEFAULT CURRENT_DATE, value INT,
               source TEXT DEFAULT 'manual' ('manual'|'health_connect'|'healthkit')
               UNIQUE(habit_id, user_id, date)
               INDEX habit_logs_habit_date(habit_id, date), INDEX habit_members_user(user_id)
```

`source` в `habit_logs`: ручной ввод vs импорт из Health Connect/HealthKit. При upsert значение из трекера не перетирает большее ручное (`CASE WHEN value >= EXCLUDED.value`).
`health_connected_at` в `users`: ставится при первом успешном импорте из Health Connect.

`avatar_url` — полный URL `https://bot.mihmih.pro/avatars/{userId}.jpg`, null если нет аватара.
Аватары хранятся на сервере: `/var/www/haba/backend/public/avatars/{userId}.jpg` (исключены из git).

**How to apply:** При добавлении новых таблиц или колонок — писать миграцию в `backend/src/db/` (в репо), коммитить, деплоить через `./deploy-backend.ps1`. Использовать `IF NOT EXISTS` и `IF NOT EXISTS column` чтобы не ломать повторные запуски.
