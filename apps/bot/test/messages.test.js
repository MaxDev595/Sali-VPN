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
