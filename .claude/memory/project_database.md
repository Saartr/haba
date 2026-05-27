---
name: project-database
description: "Схема БД PostgreSQL — таблицы users, groups, habits и связанные"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

PostgreSQL на сервере `bot.mihmih.pro`. Подключение через `DATABASE_URL` (SSL).

**Оригинальные таблицы (bot-функциональность):**
```sql
users          — id, tg_id, username, first_name, last_name, avatar_url, created_at
groups         — id, name, invite_code, creator_id → users, created_at
group_members  — user_id → users, group_id → groups, joined_at
goals          — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps          — id, user_id → users, goal_id → goals, count, recorded_at
               UNIQUE(user_id, goal_id, recorded_at)
refresh_tokens — id, user_id → users, token UNIQUE, expires_at, created_at
```

**Таблицы привычек (добавлены позже, migrate_habits.js):**
```sql
habits       — id, creator_id → users, name, category, type CHECK('solo'|'group'),
               goal_value INT NULL, goal_unit TEXT NULL, notifications BOOL,
               invite_code TEXT UNIQUE, closed_at, created_at
habit_members — habit_id → habits, user_id → users, joined_at; PK(habit_id, user_id)
habit_logs   — id, habit_id → habits, user_id → users, date DATE, value INT
               UNIQUE(habit_id, user_id, date)
```

`avatar_url` — полный URL `https://bot.mihmih.pro/avatars/{userId}.jpg`, null если нет аватара.
Аватары хранятся на сервере: `/var/www/haba/backend/public/avatars/{userId}.jpg` (исключены из git).

**How to apply:** При добавлении новых таблиц или колонок — писать миграцию в `backend/src/db/` (в репо), коммитить, деплоить через `./deploy-backend.ps1`. Использовать `IF NOT EXISTS` и `IF NOT EXISTS column` чтобы не ломать повторные запуски.
