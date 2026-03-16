import { Telegraf, Markup } from 'telegraf';

if (!process.env.BOT_TOKEN || !process.env.ADMIN_IDS) {
  console.error("❌ BOT_TOKEN or ADMIN_IDS missing");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()));

const leaveStore = new Map();   // temp leave request
const leaveCount = new Map();   // approved leave count

function nowTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
}

/* ================= /start ================= */
bot.start((ctx) => {
  ctx.reply(
    'Please select leave type:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('⏳ Half day', 'type_half'),
        Markup.button.callback('📅 One day', 'type_one'),
        Markup.button.callback('📆 Two days', 'type_two')
      ]
    ])
  );
});

/* ================= Leave Type ================= */
bot.action(/type_(.+)/, async (ctx) => {
  const type = ctx.match[1];

  leaveStore.set(ctx.from.id, {
    type
  });

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `You selected leave type: ${type}\nPlease select reason:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🛏 Sick', 'reason_sick'),
        Markup.button.callback('🚫 Personal', 'reason_personal'),
        Markup.button.callback('💉 Doctor', 'reason_doctor')
      ],
      [
        Markup.button.callback('📆 Appointment', 'reason_appointment'),
        Markup.button.callback('🎂 Birthday', 'reason_birthday'),
        Markup.button.callback('🏠 Go Home', 'reason_home')
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
  data.name = ctx.from.first_name; // ⭐ 飞机名字

  leaveStore.set(ctx.from.id, data);

  const count = leaveCount.get(ctx.from.id) || 0;

  await ctx.answerCbQuery();
  await ctx.reply(
`📩 New leave request 📩

User: ${ctx.from.id} (${data.name})
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
    data.type === 'one' ? 1 :
    2;

  const current = leaveCount.get(userId) || 0;
  leaveCount.set(userId, current + days);

  const approvedTime = nowTime(); // ✅ 通过时间（关键）

  await ctx.answerCbQuery();
  await ctx.editMessageText(
`✅ Leave approved

User ID: ${userId} (${data.name})
Leave type: ${data.type}
Reason: ${data.reason}

📊 Total leave count: ${leaveCount.get(userId)}
📅 Requested at: ${data.time}
✅ Approved at: ${approvedTime}

✅ The administrator has approved your leave successfully.
Please take a good rest ♨️ and return to work normally after your leave 💼`
  );

  // 清除已处理请求
  leaveStore.delete(userId);
});

/* ================= Reject ================= */
bot.action(/reject_(.+)/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.answerCbQuery('Admin only', { show_alert: true });
  }

  const userId = Number(ctx.match[1]);
  leaveStore.delete(userId);

  await ctx.answerCbQuery();
  await ctx.editMessageText(
`❌ Leave request rejected

The administrator has rejected this leave request.`
  );
});

bot.launch();
console.log('🚀 Leave bot updated and running');
