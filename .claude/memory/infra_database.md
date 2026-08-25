---
name: infra-database
description: "Схема БД PostgreSQL — таблицы users, groups, habits и связанные"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

PostgreSQL на сервере `bot.mihmih.pro`. Подключение через `DATABASE_URL` (SSL).

⛔ **Таблицы бота шагов (`groups`, `group_members`, `goals`, `steps`, `auth_codes`) и колонка
`users.tg_id` УДАЛЕНЫ 2026-08-25** вместе с ботом `@Step_Challenges_Bot` — см. `migrate_drop_legacy.js`
и [[feature-yandex-id]]. Ниже актуальная схема.

**Таблицы пользователей и сессий (`migrate.js`):**
```sql
users          — id, vk_id TEXT,
                 username, first_name, last_name,
                 email TEXT, phone TEXT,
                 yandex_id TEXT, yandex_avatar_id TEXT,   -- Яндекс ID (см. feature_yandex_id)
                 avatar_url, health_connected_at TIMESTAMPTZ, created_at,
                 last_login_provider TEXT NULL ('yandex'|'vk')
               partial UNIQUE INDEX users_vk_id_unique ON (vk_id) WHERE vk_id IS NOT NULL
               partial UNIQUE INDEX users_yandex_id_unique ON (yandex_id) WHERE yandex_id IS NOT NULL
refresh_tokens — id, user_id → users, token UNIQUE, expires_at, created_at
```

Аккаунт может иметь и `vk_id`, и `yandex_id` одновременно (привязка второго способа входа).
Для иконки сервиса на главном экране используется `last_login_provider` (способ последнего входа),
а не наличие `vk_id`/`yandex_id`. Обновляется в `POST /auth/vk` и `POST /auth/yandex`
при каждом логине; не трогается при `/auth/link/*` (привязка ≠ вход).

**Таблицы привычек (migrate_habits.js + migrate_pullups.js + migrate_custom.js):**
```sql
habits       — id, creator_id → users, name, category TEXT DEFAULT 'steps',
               type CHECK('solo'|'group') DEFAULT 'group',
               goal_value INT NULL, goal_unit TEXT NULL, notifications BOOL DEFAULT true,
               invite_code TEXT UNIQUE, closed_at, created_at, description TEXT NULL
               -- pullups (migrate_pullups.js), см. feature-pullups:
               current_form INT, target_reps INT, intensity TEXT ('low'|'medium'|'high'),
               training_days SMALLINT[] (1=Пн..7=Вс; reuse для periodicity='weekdays'),
               pullups_plan JSONB ([{session,sets,reps}]), pullups_session_index INT DEFAULT 0
               -- кастомный мастер (migrate_custom.js):
               checkin_type TEXT DEFAULT 'boolean' ('boolean'|'count'|'progression'),
               unit_preset TEXT ('minute'|...|'custom'; goal_unit хранит лейбл единицы),
               progression_start INT,
               periodicity TEXT DEFAULT 'daily' ('daily'|'weekdays'|'n_per_week'|'n_per_month'|'any'),
               times_per_day INT DEFAULT 1, notification_times TEXT[] (['12:00','18:00']),
               times_per_week INT, times_per_month INT,
               month_count_type TEXT ('summary'|'dates'), month_dates SMALLINT[] (32 = последний день),
               duration_type TEXT DEFAULT 'unlimited' ('unlimited'|'period'|'until_goal'),
               period_start DATE, period_end DATE
habit_members — habit_id → habits (ON DELETE CASCADE), user_id → users, joined_at; PK(habit_id, user_id)
habit_logs   — id, habit_id → habits (ON DELETE CASCADE), user_id → users,
               date DATE DEFAULT CURRENT_DATE, value INT,
               source TEXT DEFAULT 'manual' ('manual'|'health_connect'|'healthkit'),
               synced_at TIMESTAMPTZ NULL
               UNIQUE(habit_id, user_id, date)
               INDEX habit_logs_habit_date(habit_id, date), INDEX habit_members_user(user_id)
push_tokens  — id, user_id → users (ON DELETE CASCADE), token TEXT UNIQUE,
               platform TEXT, created_at, updated_at; INDEX push_tokens_user(user_id)
```

`source` в `habit_logs`: ручной ввод vs импорт из Health Connect/HealthKit. При upsert значение из трекера не перетирает большее ручное (`CASE WHEN value >= EXCLUDED.value`).
`health_connected_at` в `users`: ставится при первом успешном импорте из Health Connect.

`avatar_url` — полный URL `https://bot.mihmih.pro/avatars/{userId}.jpg`, null если нет аватара.
Аватары хранятся на сервере: `/var/www/haba/backend/public/avatars/{userId}.jpg` (исключены из git).

**How to apply:** При добавлении новых таблиц или колонок — писать миграцию в `backend/src/db/` (в репо), коммитить, деплоить через `./deploy-backend.ps1`. Использовать `IF NOT EXISTS` и `IF NOT EXISTS column` чтобы не ломать повторные запуски.
