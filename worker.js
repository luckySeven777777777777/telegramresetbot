import { Telegraf, Markup } from 'telegraf';

if (!process.env.BOT_TOKEN || !process.env.ADMIN_IDS) {
  console.error("❌ BOT_TOKEN or ADMIN_IDS missing");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()));

const leaveStore = new Map();      // temp request
const leaveCount = new Map();      // approved count

function nowTime() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

/* ================= /start ================= */
bot.start((ctx) => {
  ctx.reply(
    'Please select leave type:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Half day', 'type_half'),
        Markup.button.callback('One day', 'type_one'),
        Markup.button.callback('Two days', 'type_two')
      ]
    ])
  );
});

/* ================= Leave Type ================= */
bot.action(/type_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  leaveStore.set(ctx.from.id, { type });

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `You selected leave type: ${type}\nPlease select reason:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Sick', 'reason_sick'),
        Markup.button.callback('Personal', 'reason_personal'),
        Markup.button.callback('Doctor', 'reason_doctor')
      ],
      [
        Markup.button.callback('Appointment', 'reason_appointment'),
        Markup.button.callback('Birthday', 'reason_birthday'),
        Markup.button.callback('Go Home', 'reason_home')
      ]
    ])
  );
});

/* ================= Reason ================= */
bot.action(/reason_(.+)/, async (ctx) => {
  const reason = ctx.match[1];
  const data = leaveStore.get(ctx.from.id);
  if (!data) return ctx.answerCbQuery('Invalid request');

  data.reason = reason;
  data.time = nowTime();
  leaveStore.set(ctx.from.id, data);

  const count = leaveCount.get(ctx.from.id) || 0;

  await ctx.answerCbQuery();
  await ctx.reply(
`📩 New leave request 📩

User: ${ctx.from.id} ${ctx.from.first_name}
🔥 Leave type: ${data.type}
♻️ Reason: ${data.reason}
📊 Leave count: ${count}
📅 Requested at: ${data.time}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve', `approve_${ctx.from.id}`),
        Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)
      ]
    ])
  );
});

/* ================= Approve ================= */
bot.action(/approve_(.+)/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.answerCbQuery('Admin only', { show_alert: true });
  }

  const userId = Number(ctx.match[1]);
  const data = leaveStore.get(userId);
  if (!data) return ctx.answerCbQuery('Request not found');

  const days =
    data.type === 'half' ? 0.5 :
    data.type === 'one' ? 1 : 2;

  const current = leaveCount.get(userId) || 0;
  leaveCount.set(userId, current + days);

  await ctx.answerCbQuery();
  await ctx.editMessageText(
`✅ Leave approved

User ID: ${userId}
Leave type: ${data.type}
Reason: ${data.reason}
📊 Total leave count: ${leaveCount.get(userId)}`
  );
});

/* ================= Reject ================= */
bot.action(/reject_(.+)/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.answerCbQuery('Admin only', { show_alert: true });
  }

  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Leave request rejected');
});

bot.launch();
console.log('🚀 Leave bot updated and running');
