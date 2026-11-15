const test = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionText, duration } = require('../dist/messages');

const base = {
  registered: true,
  user: { publicId: 'ABC12345', username: null, firstName: 'Sali', isBlocked: false },
  trial: null,
  subscription: null,
  referralStats: { link: '' },
};

test('subscription screen: free time left, without technical data', () => {
  const text = subscriptionText({
    ...base,
    state: 'TRIAL_ACTIVE',
    trial: { status: 'ACTIVE', startedAt: '', expiresAt: '', secondsRemaining: 2580 },
  }, null);
  assert.match(text, /осталось 43 мин\./);
  assert.doesNotMatch(text, /telegramId|token|credential/i);
});

test('subscription screen: active plan with devices, and no access', () => {
  const active = subscriptionText({ ...base, state: 'SUBSCRIPTION_ACTIVE' }, { plan: 'Sali Pro', until: '2026-08-20T00:00:00.000Z', used: 1, max: 3 });
  assert.match(active, /Подписка активна/);
  assert.match(active, /20\.08\.2026/);
  assert.match(active, /1 из 3/);
  assert.match(subscriptionText({ ...base, state: 'SUBSCRIPTION_EXPIRED' }, null), /доступа нет/);
  assert.match(subscriptionText(null, null, 10), /скидка за друзей <b>10%<\/b>/);
});

test('rounds remaining duration up for user display', () => {
  assert.equal(duration(1), 'меньше минуты');
  assert.equal(duration(61), '2 мин.');
  assert.equal(duration(3600), '1 ч.');
});

test('plan buttons show the official price crossed out and the current one', () => {
  const { planButtonLabel } = require('../dist/keyboards');
  const plan = { code: 'pro_monthly', name: 'Sali Pro', durationDays: 30, priceUsd: 5, originalPriceUsd: 8, stars: 250, maxDevices: 3 };
  const saved = process.env.BOT_PAYMENT_METHODS;
  try {
    // USDT only (production since 2026-11-15): no Stars price on the button.
    process.env.BOT_PAYMENT_METHODS = 'crypto';
    assert.match(planButtonLabel(plan), /^1 мес\. — \$̶8̶ \$5$/);
    const discounted = { ...plan, discountPercent: 10, discountedPriceUsd: 4.5, discountedStars: 225 };
    assert.match(planButtonLabel(discounted), /\$̶5̶ \$4\.50$/);
    // Stars on: the Stars price comes back.
    process.env.BOT_PAYMENT_METHODS = 'stars,crypto';
    assert.match(planButtonLabel(plan), /^1 мес\. — \$̶8̶ \$5 · 250 ⭐$/);
    assert.match(planButtonLabel(discounted), /\$̶5̶ \$4\.50 · 225 ⭐/);
  } finally {
    if (saved === undefined) delete process.env.BOT_PAYMENT_METHODS; else process.env.BOT_PAYMENT_METHODS = saved;
  }
});

test('main menu is three buttons', () => {
  const { mainReplyKeyboard } = require('../dist/keyboards');
  const rows = mainReplyKeyboard.reply_markup.keyboard;
  assert.equal(rows.flat().length, 3);
});

test('first screen has exactly one button', () => {
  const { welcomeKeyboard } = require('../dist/keyboards');
  assert.equal(welcomeKeyboard(false).reply_markup.inline_keyboard.flat().length, 1);
  assert.equal(welcomeKeyboard(true).reply_markup.inline_keyboard.flat().length, 1);
});

test('referral message names both rewards', () => {
  const { referralMessage } = require('../dist/messages');
  const text = referralMessage({ link: 'x', totalInvited: 2, totalRewarded: 1, availableDiscounts: 1, discountPercent: 10, friendBonusHours: 3 });
  assert.match(text, /\+3 часа/);
  assert.match(text, /скидку 10%/);
});
