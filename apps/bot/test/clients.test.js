const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_TELEGRAM_IDS = '111';
const apiClient = require('../dist/services/api-client');
const { clientGate } = require('../dist/handlers/clients');

function fakeCtx({ fromId = 222, text, callback = false, preCheckout = false }) {
  const sent = [];
  return {
    sent,
    from: { id: fromId, first_name: 'Test' },
    chat: { type: 'private' },
    message: text !== undefined ? { text } : undefined,
    callbackQuery: callback ? { data: 'menu_buy' } : undefined,
    preCheckoutQuery: preCheckout ? { id: 'x' } : undefined,
    reply: async (t, extra) => { sent.push({ t, extra }); },
    replyWithHTML: async (t, extra) => { sent.push({ t, extra }); },
    answerCbQuery: async () => {},
    answerPreCheckoutQuery: async (ok, msg) => { sent.push({ t: `precheck:${ok}:${msg}` }); },
  };
}

test('admins pass through to the full bot', async () => {
  let passed = false;
  await clientGate()(fakeCtx({ fromId: 111, text: '/admin' }), async () => { passed = true; });
  assert.equal(passed, true);
});

test('customer /start link_<code> links the app and says so', async () => {
  const calls = [];
  apiClient.api.start = async (profile, param) => { calls.push(param); return { publicId: 'SL-AAAA-BBBB', link: { status: 'linked', accountId: 'SL-AAAA-BBBB' } }; };
  const ctx = fakeCtx({ text: '/start link_7K4PQ2M9' });
  let passed = false;
  await clientGate()(ctx, async () => { passed = true; });
  assert.equal(passed, false);
  assert.deepEqual(calls, ['link_7K4PQ2M9']);
  assert.match(ctx.sent[0].t, /Аккаунт привязан/);
  assert.match(ctx.sent[0].t, /SL-AAAA-BBBB/);
});

test('pasted Sali ID links too', async () => {
  const calls = [];
  apiClient.api.start = async (profile, param) => { calls.push(param); return { publicId: 'SL-AAAA-BBBB', link: { status: 'already', accountId: 'SL-AAAA-BBBB' } }; };
  const ctx = fakeCtx({ text: 'SL-7k4p-q2m9' });
  await clientGate()(ctx, async () => {});
  assert.deepEqual(calls, ['link_7K4PQ2M9']);
  assert.match(ctx.sent[0].t, /уже привязан/);
});

test('anything else from a customer points to the app, menus never run', async () => {
  apiClient.api.start = async () => ({ publicId: 'SL-AAAA-BBBB', link: null });
  for (const ctx of [fakeCtx({ text: '💎 Подписка' }), fakeCtx({ text: '/start' }), fakeCtx({ callback: true })]) {
    let passed = false;
    await clientGate()(ctx, async () => { passed = true; });
    assert.equal(passed, false);
    assert.match(ctx.sent[0].t, /в приложении/);
  }
});

test('stars checkout is refused for customers', async () => {
  const ctx = fakeCtx({ preCheckout: true });
  await clientGate()(ctx, async () => { throw new Error('must not pass'); });
  assert.match(ctx.sent[0].t, /precheck:false/);
});
