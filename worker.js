import { Telegraf, Markup } from 'telegraf';

// ===== Check environment variables =====
if (!process.env.BOT_TOKEN || !process.env.ADMIN_IDS) {
  console.error("❌ Please set BOT_TOKEN and ADMIN_IDS environment variables");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== Admin IDs (comma-separated in ENV) =====
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

// ===== Store leave requests =====
const leaveStore = new Map();

// ===== Store user leave days =====
const leaveDays = new Map();

// ===== Helper: get current month string =====
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`; // e.g. "2026-1"
}

// ===== /start command =====
bot.start((ctx) => {
  ctx.reply(
    'Please select leave type:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Half day', 'leave_half')],
      [Markup.button.callback('One day', 'leave_one')],
      [Markup.button.callback('Two days', 'leave_two')]
    ])
  );
});

// ===== Handle leave type =====
bot.action(/leave_(.+)/, async (ctx) => {
  const leaveType = ctx.match[1];
  leaveStore.set(ctx.from.id, { type: leaveType });
  await ctx.answerCbQuery();
  ctx.editMessageText(
    `You selected leave type: ${leaveType}
Please select reason:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Sick', 'reason_sick')],
      [Markup.button.callback('Personal', 'reason_personal')],
      [Markup.button.callback('Doctor', 'reason_doctor')],
      [Markup.button.callback('Appointment', 'reason_appointment')],
      [Markup.button.callback('Birthday', 'reason_birthday')],
      [Markup.button.callback('Go Home', 'reason_home')]
    ])
  );
});

// ===== Handle leave reason =====
bot.action(/reason_(.+)/, async (ctx) => {
  const reason = ctx.match[1];
  const userLeave = leaveStore.get(ctx.from.id);
  if (!userLeave) {
    await ctx.answerCbQuery('Please select leave type first');
    return;
  }
  userLeave.reason = reason;
  leaveStore.set(ctx.from.id, userLeave);
  await ctx.answerCbQuery();

  // Send request message
  await ctx.reply(
    `📩 New leave request

User: ${ctx.from.first_name}
Leave type: ${userLeave.type}
Reason: ${userLeave.reason}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Apply', `apply_${ctx.from.id}`)]
    ])
  );
});

// ===== Handle Apply button =====
bot.action(/apply_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    await ctx.answerCbQuery('Only admin can approve', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();
  ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [Markup.button.callback('Approve', `approve_${userId}`), Markup.button.callback('Reject', `reject_${userId}`)]
    ])
  );
});

// ===== Approve button =====
bot.action(/approve_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await ctx.answerCbQuery();
  const userLeave = leaveStore.get(parseInt(userId));
  if (!userLeave) {
    ctx.editMessageText('❌ Leave info not found');
    return;
  }

  // Calculate leave days
  let days = 0;
  if (userLeave.type === 'half') days = 0.5;
  else if (userLeave.type === 'one') days = 1;
  else if (userLeave.type === 'two') days = 2;

  const month = getCurrentMonth();
  if (!leaveDays.has(userId)) leaveDays.set(userId, {});
  const userMonthData = leaveDays.get(userId);

  if (!userMonthData.month || userMonthData.month !== month) {
    userMonthData.month = month;
    userMonthData.total = 0;
  }
  userMonthData.total += days;
  leaveDays.set(userId, userMonthData);

  ctx.editMessageText(
    `✅ ${ctx.from.first_name} approved user's leave
` +
    `Leave type: ${userLeave.type}
Reason: ${userLeave.reason}
` +
    `Monthly total leave: ${userMonthData.total} days`
  );
});

// ===== Reject button =====
bot.action(/reject_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await ctx.answerCbQuery();
  ctx.editMessageText(`${ctx.from.first_name} ❌ Rejected user's leave request`);
});

// ===== Launch bot =====
bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
console.log('🚀 Telegram leave bot with admin approval and monthly tracking started');
