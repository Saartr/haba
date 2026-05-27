const { session } = require('grammy');
const crypto = require('crypto');
const fss = require('fs');
const path = require('path');
const sql = require('../db/client');
const { progressBar, fmt, dayLabel } = require('../utils');

const AVATARS_DIR = '/var/www/step-bot/public/avatars';
const AVATARS_URL = 'https://bot.mihmih.pro/avatars';

if (!fss.existsSync(AVATARS_DIR)) {
  fss.mkdirSync(AVATARS_DIR, { recursive: true });
}

async function fetchAndSaveAvatar(bot, tgId, userId) {
  try {
    const photos = await bot.api.getUserProfilePhotos(tgId, { limit: 1 });
    if (!photos.total_count) return null;
    const fileId = photos.photos[0][0].file_id;
    const file = await bot.api.getFile(fileId);
    const fileUrl = 'https://api.telegram.org/file/bot' + process.env.TELEGRAM_TOKEN + '/' + file.file_path;
    const resp = await fetch(fileUrl);
    if (!resp.ok) return null;
    const ext = path.extname(file.file_path) || '.jpg';
    const filename = userId + ext;
    const dest = path.join(AVATARS_DIR, filename);
    const buffer = Buffer.from(await resp.arrayBuffer());
    fss.writeFileSync(dest, buffer);
    return AVATARS_URL + '/' + filename;
  } catch {
    return null;
  }
}

async function upsertUser(bot, tgFrom) {
  const tgId = tgFrom.id;
  const username = tgFrom.username || null;
  const firstName = tgFrom.first_name || null;
  const lastName = tgFrom.last_name || null;
  await sql`
    INSERT INTO users (tg_id, username, first_name, last_name)
    VALUES (${tgId}, ${username}, ${firstName}, ${lastName})
    ON CONFLICT (tg_id) DO UPDATE
      SET username   = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name  = EXCLUDED.last_name
  `;
  const [user] = await sql`SELECT id, avatar_url FROM users WHERE tg_id = ${tgId}`;
  if (!user.avatar_url) {
    const avatarUrl = await fetchAndSaveAvatar(bot, tgId, user.id);
    if (avatarUrl) await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${user.id}`;
  }
  return user;
}

function setupCommands(bot) {

  bot.use(session({ initial: () => ({ waitingFor: null, goalGroupId: null, goalData: null }) }));

  bot.command('start', async (ctx) => {
    const param = ctx.match;

    if (param && param.startsWith('invite_')) {
      const inviteCode = param.replace('invite_', '');
      const user = await upsertUser(bot, ctx.from);

      const [group] = await sql`SELECT * FROM groups WHERE invite_code = ${inviteCode}`;

      if (!group) {
        return ctx.reply('Группа не найдена. Попроси друга прислать новую ссылку.');
      }

      await sql`
        INSERT INTO group_members (user_id, group_id)
        VALUES (${user.id}, ${group.id})
        ON CONFLICT DO NOTHING
      `;

      const [creator] = await sql`SELECT tg_id FROM users WHERE id = ${group.creator_id}`;
      await ctx.api.sendMessage(
        creator.tg_id,
        `👋 @${username} присоединился к группе «${group.name}»!`
      );

      return ctx.reply(`Ты в группе «${group.name}»! 🎉\nЖди старта челленджа.`);
    }

    const user = await upsertUser(bot, ctx.from);

    const groups = await sql`
        SELECT DISTINCT g.name FROM groups g
        LEFT JOIN group_members gm ON gm.group_id = g.id
        WHERE g.creator_id = ${user.id} OR gm.user_id = ${user.id}
        ORDER BY g.name
      `;

      if (groups.length) {
        const groupList = groups.map(g => `· ${g.name}`).join('\n');
        return ctx.reply(
          `С возвращением! 👟\n\nТвои группы:\n${groupList}\n\n/status — прогресс · /help — команды`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Создать группу', callback_data: 'create_group' },
                { text: '🔗 Войти в группу', callback_data: 'join_group' },
              ]]
            }
          }
        );
      }

    await ctx.reply('Привет! Готов считать шаги? 👟', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Создать группу', callback_data: 'create_group' },
          { text: '🔗 Войти в группу', callback_data: 'join_group' },
        ]]
      }
    });
  });

  bot.callbackQuery('create_group', async (ctx) => {
    ctx.session.waitingFor = 'group_name';
    await ctx.answerCallbackQuery();
    await ctx.reply('Как назовём группу? Напиши название:');
  });

  bot.callbackQuery('join_group', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Попроси друга прислать тебе ссылку-приглашение.');
  });

  bot.callbackQuery(/^set_goal_(\d+)$/, async (ctx) => {
    const groupId = parseInt(ctx.match[1]);
    const [group] = await sql`SELECT name FROM groups WHERE id = ${groupId}`;
    ctx.session.goalData = null;
    await ctx.answerCallbackQuery();
    return askStepsPerDay(ctx, groupId, group.name);
  });

  bot.callbackQuery(/^goal_steps_(\d+)$/, async (ctx) => {
    ctx.session.goalData = { steps: parseInt(ctx.match[1]) };
    await ctx.answerCallbackQuery();
    await ctx.reply('На сколько дней?', {
      reply_markup: {
        inline_keyboard: [[
          { text: '7 дней', callback_data: 'goal_period_7' },
          { text: '14 дней', callback_data: 'goal_period_14' },
          { text: '30 дней', callback_data: 'goal_period_30' },
        ]]
      }
    });
  });

  bot.callbackQuery('goal_steps_custom', async (ctx) => {
    ctx.session.waitingFor = 'goal_steps_custom';
    await ctx.answerCallbackQuery();
    await ctx.reply('Введи количество шагов в день (число):');
  });

  bot.callbackQuery(/^goal_period_(\d+)$/, async (ctx) => {
    const days = parseInt(ctx.match[1]);
    const { goalGroupId, goalData } = ctx.session;

    if (!goalGroupId || !goalData?.steps) {
      await ctx.answerCallbackQuery();
      return ctx.reply('Что-то пошло не так. Начни заново с /goal.');
    }

    const startsAt = new Date();
    const deadline = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    const [existing] = await sql`SELECT id FROM goals WHERE group_id = ${goalGroupId}`;
    if (existing) {
      await sql`
        UPDATE goals
        SET steps_per_day = ${goalData.steps}, period_days = ${days},
            starts_at = ${startsAt}, deadline = ${deadline}
        WHERE group_id = ${goalGroupId}
      `;
    } else {
      await sql`
        INSERT INTO goals (group_id, steps_per_day, period_days, starts_at, deadline)
        VALUES (${goalGroupId}, ${goalData.steps}, ${days}, ${startsAt}, ${deadline})
      `;
    }

    ctx.session.goalGroupId = null;
    ctx.session.goalData = null;

    const [group] = await sql`SELECT name FROM groups WHERE id = ${goalGroupId}`;
    const members = await sql`
      SELECT u.tg_id FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${goalGroupId}
    `;

    const deadlineStr = deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const stepsFormatted = goalData.steps.toLocaleString('ru-RU');
    const broadcastMsg =
      `🚀 Челлендж «${group.name}» начался!\n\n` +
      `🎯 Цель: ${stepsFormatted} шагов в день\n` +
      `📅 Период: ${days} ${dayLabel(days)} (до ${deadlineStr})\n\n` +
      `Погнали! 💪`;

    for (const member of members) {
      try { await ctx.api.sendMessage(member.tg_id, broadcastMsg); } catch (_) {}
    }

    await ctx.answerCallbackQuery();
    await ctx.reply('Цель задана! Всем участникам отправлено уведомление. 🎉');
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();

    const state = ctx.session.waitingFor;

    if (state === 'group_name') {
      const groupName = ctx.message.text.trim();
      const user = await upsertUser(bot, ctx.from);
      const inviteCode = crypto.randomBytes(4).toString('hex');

      const [group] = await sql`
        INSERT INTO groups (name, invite_code, creator_id)
        VALUES (${groupName}, ${inviteCode}, ${user.id})
        RETURNING *
      `;

      ctx.session.waitingFor = null;

      const inviteLink = `https://t.me/${ctx.me.username}?start=invite_${inviteCode}`;

      await ctx.reply(
        `Группа «${groupName}» создана! 🎉\n\n` +
        `Отправь друзьям эту ссылку:\n${inviteLink}\n\n` +
        `Когда все соберутся — задай цель челленджа:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎯 Задать цель', callback_data: `set_goal_${group.id}` }
            ]]
          }
        }
      );
      return;
    }

    if (state === 'goal_steps_custom') {
      const steps = parseInt(ctx.message.text.trim());
      if (isNaN(steps) || steps < 100 || steps > 100000) {
        return ctx.reply('Введи число от 100 до 100 000.');
      }
      ctx.session.goalData = { steps };
      ctx.session.waitingFor = null;
      await ctx.reply('На сколько дней?', {
        reply_markup: {
          inline_keyboard: [[
            { text: '7 дней', callback_data: 'goal_period_7' },
            { text: '14 дней', callback_data: 'goal_period_14' },
            { text: '30 дней', callback_data: 'goal_period_30' },
          ]]
        }
      });
      return;
    }
  });

  bot.command('members', async (ctx) => {
    const tgId = ctx.from.id;
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;
    if (!user) return ctx.reply('Ты ещё не в группе.');

    const groups = await sql`
      SELECT DISTINCT g.id, g.name, g.creator_id
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.creator_id = ${user.id} OR gm.user_id = ${user.id}
      ORDER BY g.id DESC
    `;
    if (!groups.length) return ctx.reply('Ты не состоишь ни в одной группе.');

    if (groups.length === 1) return showMembers(ctx, user, groups[0]);

    const buttons = groups.map(g => [{ text: g.name, callback_data: `members_group_${g.id}` }]);
    await ctx.reply('Участники какой группы?', { reply_markup: { inline_keyboard: buttons } });
  });

  bot.callbackQuery(/^members_group_(\d+)$/, async (ctx) => {
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${ctx.from.id}`;
    const [group] = await sql`SELECT id, name, creator_id FROM groups WHERE id = ${parseInt(ctx.match[1])}`;
    await ctx.answerCallbackQuery();
    return showMembers(ctx, user, group);
  });

  bot.callbackQuery(/^kick_(\d+)_(\d+)$/, async (ctx) => {
    const kickUserId = parseInt(ctx.match[1]);
    const groupId   = parseInt(ctx.match[2]);

    const [requester] = await sql`SELECT id FROM users WHERE tg_id = ${ctx.from.id}`;
    const [group] = await sql`SELECT id, name, creator_id FROM groups WHERE id = ${groupId}`;
    await ctx.answerCallbackQuery();

    if (!group || group.creator_id !== requester.id) {
      return ctx.reply('У тебя нет прав выгонять участников этой группы.');
    }
    if (kickUserId === requester.id) {
      return ctx.reply('Нельзя выгнать себя.');
    }

    const [kicked] = await sql`SELECT tg_id, username FROM users WHERE id = ${kickUserId}`;
    if (!kicked) return ctx.reply('Участник не найден.');

    await sql`DELETE FROM group_members WHERE user_id = ${kickUserId} AND group_id = ${groupId}`;

    try {
      await ctx.api.sendMessage(kicked.tg_id, `😔 Тебя удалили из группы «${group.name}».`);
    } catch (_) {}

    await ctx.reply(`@${kicked.username} удалён из группы «${group.name}».`);
    return showMembers(ctx, requester, group);
  });

  bot.command('goal', async (ctx) => {
    const tgId = ctx.from.id;
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;

    if (!user) return ctx.reply('Сначала создай группу через /start.');

    const groups = await sql`
      SELECT id, name FROM groups WHERE creator_id = ${user.id} ORDER BY id DESC
    `;
    if (!groups.length) return ctx.reply('Ты не являешься создателем ни одной группы.');

    ctx.session.goalData = null;
    ctx.session.waitingFor = null;

    if (groups.length === 1) {
      return askStepsPerDay(ctx, groups[0].id, groups[0].name);
    }

    const buttons = groups.map(g => [{ text: g.name, callback_data: `select_goal_group_${g.id}` }]);
    await ctx.reply('Для какой группы задаём цель?', {
      reply_markup: { inline_keyboard: buttons }
    });
  });

  bot.callbackQuery(/^select_goal_group_(\d+)$/, async (ctx) => {
    const groupId = parseInt(ctx.match[1]);
    const [group] = await sql`SELECT name FROM groups WHERE id = ${groupId}`;
    await ctx.answerCallbackQuery();
    ctx.session.goalData = null;
    return askStepsPerDay(ctx, groupId, group.name);
  });
// Эпик 6 — новый вызов после финала
  bot.callbackQuery(/^new_challenge_(\d+)$/, async (ctx) => {
    const groupId = parseInt(ctx.match[1]);
    const [group] = await sql`SELECT name FROM groups WHERE id = ${groupId}`;
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    ctx.session.goalData = null;
    ctx.session.waitingFor = null;
    return askStepsPerDay(ctx, groupId, group.name);
  });

  bot.callbackQuery('no_new_challenge', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await ctx.reply('Окей! Если захочешь начать новый челлендж — просто напиши /goal. 👟');
  });
bot.command('app', async (ctx) => {
    await ctx.reply('Открой Mini App чтобы записать шаги 👟', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '👟 Записать шаги',
            web_app: { url: 'https://bot.mihmih.pro/miniapp' }
          }
        ]]
      }
    });
  });
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *Команды бота*\n\n` +
      `*Участник*\n` +
      `/steps <число> — записать шаги за сегодня\n` +
      `/status — твой прогресс и таблица лидеров\n` +
      `/members — участники группы\n\n` +
      `*Создатель группы*\n` +
      `/goal — задать или обновить цель челленджа\n` +
      `/members — управление участниками (кик)\n` +
      `/deletegroup — удалить группу\n\n` +
      `*Прочее*\n` +
      `/start — главное меню\n` +
      `/help — эта справка`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('deletegroup', async (ctx) => {
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${ctx.from.id}`;
    if (!user) return ctx.reply('У тебя нет групп.');

    const groups = await sql`SELECT id, name FROM groups WHERE creator_id = ${user.id} ORDER BY id DESC`;
    if (!groups.length) return ctx.reply('Ты не являешься создателем ни одной группы.');

    if (groups.length === 1) return askDeleteConfirm(ctx, groups[0]);

    const buttons = groups.map(g => [{ text: g.name, callback_data: `delete_group_pick_${g.id}` }]);
    await ctx.reply('Какую группу удалить?', { reply_markup: { inline_keyboard: buttons } });
  });

  bot.callbackQuery(/^delete_group_pick_(\d+)$/, async (ctx) => {
    const [group] = await sql`SELECT id, name FROM groups WHERE id = ${parseInt(ctx.match[1])}`;
    await ctx.answerCallbackQuery();
    return askDeleteConfirm(ctx, group);
  });

  bot.callbackQuery(/^confirm_delete_group_(\d+)$/, async (ctx) => {
    const groupId = parseInt(ctx.match[1]);
    const [requester] = await sql`SELECT id FROM users WHERE tg_id = ${ctx.from.id}`;
    const [group] = await sql`SELECT id, name, creator_id FROM groups WHERE id = ${groupId}`;
    await ctx.answerCallbackQuery();

    if (!group || group.creator_id !== requester.id) {
      return ctx.reply('У тебя нет прав удалять эту группу.');
    }

    const members = await sql`
      SELECT u.tg_id FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${groupId} AND gm.user_id != ${requester.id}
    `;

    await sql`DELETE FROM steps WHERE goal_id IN (SELECT id FROM goals WHERE group_id = ${groupId})`;
    await sql`DELETE FROM goals WHERE group_id = ${groupId}`;
    await sql`DELETE FROM group_members WHERE group_id = ${groupId}`;
    await sql`DELETE FROM groups WHERE id = ${groupId}`;

    for (const m of members) {
      try { await ctx.api.sendMessage(m.tg_id, `❌ Группа «${group.name}» была удалена создателем.`); } catch (_) {}
    }

    await ctx.reply(`Группа «${group.name}» удалена.`);
  });

  bot.callbackQuery('cancel_delete_group', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await ctx.reply('Отменено.');
  });

  bot.command('steps', async (ctx) => {
    const count = parseInt(ctx.match);
    if (isNaN(count) || count < 0 || count > 200000) {
      return ctx.reply('Использование: /steps <число>\nНапример: /steps 8500');
    }

    const tgId = ctx.from.id;
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;
    if (!user) return ctx.reply('Сначала вступи в группу через /start.');

    const goal = await findActiveGoal(sql, user.id);
    if (!goal) return ctx.reply('Нет активного челленджа. Попроси создателя группы задать цель.');

    await sql`
      INSERT INTO steps (user_id, goal_id, count, recorded_at)
      VALUES (${user.id}, ${goal.id}, ${count}, CURRENT_DATE)
      ON CONFLICT (user_id, goal_id, recorded_at)
      DO UPDATE SET count = ${count}
    `;

    const percent = Math.round((count / goal.steps_per_day) * 100);
    let msg =
      `✅ Записано: *${fmt(count)}* шагов за сегодня\n\n` +
      `${progressBar(percent)} ${percent}%\n` +
      `Цель: ${fmt(goal.steps_per_day)} шагов/день`;

    if (count >= goal.steps_per_day) msg += '\n\n🎉 Цель на сегодня выполнена!';

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('status', async (ctx) => {
    const tgId = ctx.from.id;
    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;
    if (!user) return ctx.reply('Сначала вступи в группу через /start.');

    const goal = await findActiveGoal(sql, user.id);
    if (!goal) return ctx.reply('Нет активного челленджа. Попроси создателя группы задать цель через /goal.');

    const [dates] = await sql`
      SELECT
        (CURRENT_DATE - starts_at) + 1  AS days_passed,
        GREATEST(deadline - CURRENT_DATE, 0) AS days_left,
        period_days
      FROM goals WHERE id = ${goal.id}
    `;
    const daysPassed = parseInt(dates.days_passed);
    const daysLeft   = parseInt(dates.days_left);

    const [my] = await sql`
      SELECT
        COALESCE(SUM(count), 0)                                                AS total,
        COALESCE(MAX(count) FILTER (WHERE recorded_at = CURRENT_DATE), 0)      AS today
      FROM steps
      WHERE user_id = ${user.id} AND goal_id = ${goal.id}
    `;
    const myTotal = parseInt(my.total);
    const myToday = parseInt(my.today);
    const myAvg   = daysPassed > 0 ? Math.round(myTotal / daysPassed) : 0;
    const planSoFar = goal.steps_per_day * daysPassed;
    const percent = planSoFar > 0 ? Math.round((myTotal / planSoFar) * 100) : 0;

    const leaderboard = await sql`
      SELECT u.username,
        COALESCE(SUM(s.count), 0) AS total_steps,
        COALESCE(MAX(s.count) FILTER (WHERE s.recorded_at = CURRENT_DATE), 0) AS today_steps
      FROM (
        SELECT creator_id AS user_id FROM groups WHERE id = ${goal.group_id}
        UNION
        SELECT user_id FROM group_members WHERE group_id = ${goal.group_id}
      ) m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN steps s ON s.user_id = u.id AND s.goal_id = ${goal.id}
      GROUP BY u.id, u.username
      ORDER BY total_steps DESC
    `;

    const deadline = new Date(goal.deadline);
    const deadlineStr = deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const medals = ['🥇', '🥈', '🥉'];

    let msg =
      `📊 *${goal.group_name}*\n` +
      `🎯 ${fmt(goal.steps_per_day)} шагов/день · ${dates.period_days} дней\n` +
      `📅 До ${deadlineStr} — осталось ${daysLeft} ${dayLabel(daysLeft)}\n\n` +
      `👤 *Твой прогресс*\n` +
      `Сегодня: ${fmt(myToday)} шагов\n` +
      `Всего: ${fmt(myTotal)} шагов\n` +
      `Средн./день: ${fmt(myAvg)}\n` +
      `${progressBar(percent)} ${percent}% от плана\n\n` +
      `🏆 *Таблица лидеров*\n` +
      leaderboard.map((r, i) => {
        const today = parseInt(r.today_steps);
        const total = parseInt(r.total_steps);
        const p = Math.round((today / goal.steps_per_day) * 100);
        return `${medals[i] ?? `${i + 1}.`} @${r.username} — ${fmt(today)} ${progressBar(p)} ${p}%\n` +
               `    Всего: ${fmt(total)}`;
      }).join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}

async function askDeleteConfirm(ctx, group) {
  await ctx.reply(
    `⚠️ Удалить группу *«${group.name}»*?\n\nВсе цели и шаги участников будут удалены. Это действие необратимо.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑 Да, удалить', callback_data: `confirm_delete_group_${group.id}` },
          { text: '❌ Отмена',      callback_data: 'cancel_delete_group' },
        ]]
      }
    }
  );
}

async function showMembers(ctx, user, group) {
  const members = await sql`
    SELECT u.id, u.username
    FROM (
      SELECT creator_id AS user_id FROM groups WHERE id = ${group.id}
      UNION
      SELECT user_id FROM group_members WHERE group_id = ${group.id}
    ) m
    JOIN users u ON u.id = m.user_id
    ORDER BY u.id
  `;

  const isCreator = group.creator_id === user.id;

  const list = members.map((m, i) => {
    const crown = m.id === group.creator_id ? ' 👑' : '';
    return `${i + 1}. @${m.username}${crown}`;
  }).join('\n');

  let keyboard;
  if (isCreator) {
    const kickable = members.filter(m => m.id !== group.creator_id);
    if (kickable.length) {
      const rows = [];
      for (let i = 0; i < kickable.length; i += 2) {
        rows.push(kickable.slice(i, i + 2).map(m => ({
          text: `❌ @${m.username}`,
          callback_data: `kick_${m.id}_${group.id}`,
        })));
      }
      keyboard = { inline_keyboard: rows };
    }
  }

  await ctx.reply(
    `👥 *${group.name}* — ${members.length} уч.\n\n${list}`,
    { parse_mode: 'Markdown', ...(keyboard ? { reply_markup: keyboard } : {}) }
  );
}

async function askStepsPerDay(ctx, groupId, groupName) {
  ctx.session.goalGroupId = groupId;
  await ctx.reply(`Задаём цель для группы «${groupName}»\n\nСколько шагов в день?`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '5 000', callback_data: 'goal_steps_5000' },
          { text: '8 000', callback_data: 'goal_steps_8000' },
          { text: '10 000', callback_data: 'goal_steps_10000' },
        ],
        [{ text: '✏️ Свой вариант', callback_data: 'goal_steps_custom' }]
      ]
    }
  });
}

async function findActiveGoal(sql, userId) {
  const [goal] = await sql`
    SELECT g.*, gr.name AS group_name
    FROM goals g
    JOIN groups gr ON gr.id = g.group_id
    WHERE (
      gr.creator_id = ${userId}
      OR gr.id IN (SELECT group_id FROM group_members WHERE user_id = ${userId})
    )
    AND g.starts_at  <= CURRENT_DATE
    AND g.deadline   >= CURRENT_DATE
    ORDER BY g.id DESC
    LIMIT 1
  `;
  return goal ?? null;
}

module.exports = setupCommands;
