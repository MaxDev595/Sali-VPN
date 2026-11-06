const test = require('node:test');
const assert = require('node:assert/strict');
const { accessText, duration } = require('../dist/messages');

const base = {
  registered: true,
  user: { publicId: 'ABC12345', username: null, firstName: 'Sali', isBlocked: false },
  trial: null,
  subscription: null,
  referralStats: { link: '' },
};

test('formats trial time without exposing technical data', () => {
  const text = accessText({
    ...base,
    state: 'TRIAL_ACTIVE',
    trial: { status: 'ACTIVE', startedAt: '', expiresAt: '', secondsRemaining: 2580 },
  });
  assert.match(text, /Осталось: 43 мин\./);
  assert.doesNotMatch(text, /telegramId|token|credential/i);
});

test('formats active and expired subscription states', () => {
  const active = accessText({
    ...base,
    state: 'SUBSCRIPTION_ACTIVE',
    subscription: {
      status: 'ACTIVE', startedAt: null, expiresAt: '2026-08-20T00:00:00.000Z', plan: { name: 'Sali Pro' },
    },
  });
  assert.match(active, /Sali Pro/);
  assert.match(active, /20\.08\.2026/);
  assert.match(accessText({ ...base, state: 'SUBSCRIPTION_EXPIRED' }), /Подписка закончилась/);
});

test('rounds remaining duration up for user display', () => {
  assert.equal(duration(1), 'меньше минуты');
  assert.equal(duration(61), '2 мин.');
  assert.equal(duration(3600), '1 ч.');
});

test('plans show the official price crossed out and the current one', () => {
  const { plansMessage } = require('../dist/messages');
  const { planButtonLabel } = require('../dist/keyboards');
  const plan = { code: 'pro_monthly', name: 'Sali Pro', durationDays: 30, priceUsd: 5, originalPriceUsd: 8, stars: 250, maxDevices: 3 };
  assert.match(plansMessage([plan]), /<s>\$8<\/s> <b>\$5<\/b> · 250 ⭐/);
  assert.match(planButtonLabel(plan), /^1 мес\. — \$̶8̶ \$5 · 250 ⭐$/);
});

test('referral discount replaces the price and is announced', () => {
  const { plansMessage } = require('../dist/messages');
  const plan = { code: 'pro_monthly', name: 'Sali Pro', durationDays: 30, priceUsd: 5, originalPriceUsd: 8, stars: 250, maxDevices: 3, discountPercent: 10, discountedPriceUsd: 4.5, discountedStars: 225 };
  const text = plansMessage([plan]);
  assert.match(text, /<s>\$5<\/s> <b>\$4\.50<\/b> · 225 ⭐/);
  assert.match(text, /скидка <b>10%<\/b>/);
});

test('referral message names both rewards', () => {
  const { referralMessage } = require('../dist/messages');
  const text = referralMessage({ link: 'x', totalInvited: 2, totalRewarded: 1, availableDiscounts: 1, discountPercent: 10, friendBonusHours: 3 });
  assert.match(text, /\+3 часа/);
  assert.match(text, /скидку 10%/);
});
