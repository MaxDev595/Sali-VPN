// Run against a TEST API + its database (never production):
//   API_URL=http://localhost:3999 DATABASE_URL=… INTERNAL_API_KEY=… ADMIN_TELEGRAM_IDS=111 VPN_PROVIDER=mock HAPP_ENABLED=true node apps/api/test-e2e-app-only.js
// The API must be started with ADMIN_TELEGRAM_IDS=111, VPN_PROVIDER=mock and CRYPTO_TON_RECEIVE_ADDRESS set; seed plans first (prisma/seed).
// End-to-end: the app-only flow against a real API + Postgres (VPN_PROVIDER=mock).
const assert = require('node:assert/strict');
const { Client } = require('pg');
const BASE = (process.env.API_URL ?? "http://localhost:3999") + "/api/v1";
const INTERNAL = process.env.INTERNAL_API_KEY;
const db = new Client({ connectionString: process.env.DATABASE_URL });

let step = 0;
const ok = (msg) => console.log(`✔ ${++step}. ${msg}`);

async function call(path, { token, method = 'GET', body, headers = {}, expect = 200 } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && !want429(expect)) { await new Promise((r) => setTimeout(r, 61_000)); return call(path, { token, method, body, headers, expect }); }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  const want = Array.isArray(expect) ? expect : [expect];
  if (!want.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return json;
}
function want429(expect) { return (Array.isArray(expect) ? expect : [expect]).includes(429); }
const internal = (path, body) => call(path, { method: 'POST', body, headers: { 'X-Internal-Api-Key': INTERNAL }, expect: [200, 201] });

async function device(name) {
  const deviceKey = `test-device-${name}-${Math.random().toString(36).slice(2)}xxxxxxxx`;
  const { token } = await call('/auth/app', { method: 'POST', body: { deviceKey }, expect: [200, 201] });
  await call('/devices/current', { token, method: 'POST', body: { deviceKey, name: `Phone ${name}`, platform: 'ANDROID' }, expect: [200, 201] });
  const d = { name, token, deviceKey };
  d.home = () => call('/home', { token });
  d.connect = (expect = [200, 201]) => call('/vpn/connect', { token, method: 'POST', body: {}, headers: { 'X-Device-Key': deviceKey }, expect });
  return d;
}
const linkTo = (d, home, tg, username) => internal('/internal/bot/start', { profile: { telegramId: tg, username, firstName: username }, startParam: `link_${home.device.linkCode}` });
async function pay(paymentId) {
  const { rows } = await db.query('select "externalPaymentId" from "Payment" where id=$1', [paymentId]);
  await internal('/internal/payments/confirm', { externalPaymentId: rows[0].externalPaymentId });
}

(async () => {
  await db.connect();

  // --- free 24 hours: just «Включить», no Telegram ---
  const A = await device('A');
  let hA = await A.home();
  assert.match(hA.user.publicId, /^SL-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.match(hA.device.id, /^D-[0-9A-F]{6}$/);
  assert.equal(hA.telegram.linked, false);
  assert.equal(hA.isAdmin, false);
  const idA = hA.user.publicId;
  ok(`new install: account ID ${idA}, device label ${hA.device.id}, no Telegram`);

  await A.connect();
  hA = await A.home();
  assert.equal(hA.trial.status, 'ACTIVE');
  assert.ok(hA.trial.secondsRemaining > 23 * 3600);
  ok('«Включить» without Telegram → free 24 hours started, VPN config returned');

  const noTg = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_monthly' }, expect: 403 });
  assert.equal(noTg.code, 'TELEGRAM_REQUIRED');
  ok('paying without Telegram → 403 TELEGRAM_REQUIRED (app shows «Привязать Telegram»)');

  // --- link Telegram: the account keeps the ID the customer already sees ---
  const started = await linkTo(A, hA, 222, 'alice');
  assert.equal(started.link.status, 'linked');
  assert.equal(started.link.accountId, idA);
  hA = await A.home();
  assert.equal(hA.user.publicId, idA);
  assert.equal(hA.telegram.linked, true);
  assert.equal(hA.telegram.username, 'alice');
  ok(`linked to Telegram: account ID stays ${idA}; bot replies with the same ID`);

  // --- buy in the app (USDT TON) ---
  const plans = await call('/app/plans', { token: A.token });
  assert.equal(plans.telegramLinked, true);
  assert.deepEqual(plans.plans.map((p) => [p.code, p.durationDays, p.priceUsd, p.description]), [['pro_7d', 7, 1.2, 'Недельное использование'], ['pro_14d', 14, 2, 'Две недели'], ['pro_monthly', 30, 3, 'Основная подписка'], ['pro_90d', 90, 8, 'Постоянные пользователи'], ['pro_180d', 180, 15, 'Полгода'], ['pro_yearly', 365, 30, 'Год']]);
  assert.equal(plans.plans.find((p) => p.code === 'pro_yearly').perMonthUsd, 2.47);
  const inv = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_monthly' }, expect: [200, 201] });
  assert.equal(inv.amount, '3');
  assert.equal(inv.asset, 'USDT');
  assert.match(inv.comment, /^SALI-[0-9A-F]{12}$/);
  assert.match(inv.tonUrl, /^ton:\/\/transfer\//);
  assert.match(inv.tonkeeperUrl, /^https:\/\/app\.tonkeeper\.com\/transfer\//);
  let st = await call(`/app/payments/${inv.paymentId}`, { token: A.token });
  assert.equal(st.status, 'PENDING');
  ok(`invoice: ${inv.amount} ${inv.asset}, comment ${inv.comment}, wallet deep links`);

  await pay(inv.paymentId);
  st = await call(`/app/payments/${inv.paymentId}`, { token: A.token });
  assert.equal(st.status, 'SUCCEEDED');
  assert.ok(Date.parse(st.until) > Date.now() + 29 * 86400e3);
  hA = await A.home();
  assert.equal(hA.subscription.status, 'ACTIVE');
  assert.equal(hA.account.accountId, idA);
  ok(`paid → subscription on the account until ${st.until.slice(0, 10)}`);

  // --- second device on the same Telegram: same account ID, own device label ---
  const B = await device('B');
  let hB = await B.home();
  assert.notEqual(hB.user.publicId, idA);
  await linkTo(B, hB, 222, 'alice');
  hB = await B.home();
  assert.equal(hB.user.publicId, idA);
  assert.notEqual(hB.device.id, hA.device.id);
  assert.equal(hB.subscription?.status, 'ACTIVE');
  await B.connect();
  const devs = await call('/app/devices', { token: A.token });
  assert.equal(devs.devices.length, 2);
  assert.ok(devs.devices.every((d) => /^D-[0-9A-F]{6}$/.test(d.id) && d.covered));
  ok(`second phone linked: shows the same ${idA}, devices ${devs.devices.map((d) => d.id).join(', ')} share the subscription`);

  // A free 24h already used by the account: a new linked device does not get another one.
  const B2 = await device('B2');
  const hB2 = await B2.home();
  await linkTo(B2, hB2, 333, 'bob');           // bob: account whose first app already used its trial
  await B2.connect();                            // bob starts nothing yet… (B2 is bob's first app → it gets the 24h on connect)
  const B3 = await device('B3');
  await B3.connect();                            // B3 used its own free 24h before linking
  await linkTo(B3, await B3.home(), 333, 'bob');
  const B4 = await device('B4');
  await linkTo(B4, await B4.home(), 333, 'bob');
  const denied = await B4.connect(403);
  assert.match(denied.message, /уже использованы/);
  ok('free 24 hours: once per account — a third phone of the same Telegram is asked to subscribe');

  // --- admin ---
  const ADM = await device('ADM');
  await linkTo(ADM, await ADM.home(), 111, 'owner');
  const hAdm = await ADM.home();
  assert.equal(hAdm.isAdmin, true);
  await call('/app/admin/stats', { token: A.token, expect: 403 });
  const stats = await call('/app/admin/stats', { token: ADM.token });
  assert.equal(stats.revenue.total, 3);
  ok(`admin: isAdmin only for ADMIN_TELEGRAM_IDS; stats revenue $${stats.revenue.total}; others get 403`);

  await call('/app/admin/promos', { token: ADM.token, method: 'POST', body: { code: 'week7', kind: 'DAYS', days: 7, maxUses: 1 }, expect: [200, 201] });
  await call('/app/admin/promos', { token: ADM.token, method: 'POST', body: { code: 'HALF', kind: 'DISCOUNT', discountPercent: 50 }, expect: [200, 201] });
  await call('/app/admin/promos', { token: ADM.token, method: 'POST', body: { code: 'HALF', kind: 'DISCOUNT', discountPercent: 10 }, expect: 409 });
  const promos = await call('/app/admin/promos', { token: ADM.token });
  assert.deepEqual(promos.map((p) => p.code).sort(), ['HALF', 'WEEK7']);
  ok('admin created promo codes WEEK7 (+7 days, 1 use) and HALF (−50%); duplicates refused');

  // --- promo codes ---
  const D = await device('D');
  const p1 = await call('/app/promo', { token: D.token, method: 'POST', body: { code: 'week7' }, expect: [200, 201] });
  assert.equal(p1.kind, 'DAYS');
  let hD = await D.home();
  assert.equal(hD.subscription?.status, 'ACTIVE');
  await call('/app/promo', { token: D.token, method: 'POST', body: { code: 'WEEK7' }, expect: 409 });
  const E = await device('E');
  const gone = await call('/app/promo', { token: E.token, method: 'POST', body: { code: 'WEEK7' }, expect: 410 });
  assert.match(gone.message, /закончился/);
  await call('/app/promo', { token: E.token, method: 'POST', body: { code: 'NOPE' }, expect: 404 });
  ok('DAYS promo: +7 days to an unlinked install; second use and over-limit refused');

  const half = await call('/app/promo', { token: A.token, method: 'POST', body: { code: 'half' }, expect: [200, 201] });
  assert.deepEqual(half, { kind: 'DISCOUNT', code: 'HALF', percent: 50 });
  const inv2 = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_yearly', promo: 'HALF' }, expect: [200, 201] });
  assert.equal(inv2.amount, '15');
  assert.equal(inv2.discountPercent, 50);
  await pay(inv2.paymentId);
  await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_monthly', promo: 'HALF' }, expect: 409 });
  const used = (await call('/app/admin/promos', { token: ADM.token })).find((p) => p.code === 'HALF');
  assert.equal(used.usedCount, 1);
  hA = await A.home();
  assert.ok(Date.parse(hA.subscription.expiresAt) > Date.now() + 390 * 86400e3);
  ok('DISCOUNT promo: yearly for 15 USDT instead of 30, days stacked on the subscription, code counted once per account');

  // --- gift to a friend's Sali ID ---
  const F = await device('F');
  const idF = (await F.home()).user.publicId;
  const chk = await call('/app/gift/check', { token: A.token, method: 'POST', body: { code: idF.toLowerCase() }, expect: [200, 201] });
  assert.equal(chk.to, idF);
  await call('/app/gift/check', { token: A.token, method: 'POST', body: { code: idA }, expect: 400 });
  const gift = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_monthly', giftTo: idF }, expect: [200, 201] });
  assert.equal(gift.gift, idF);
  const before = (await A.home()).subscription.expiresAt;
  await pay(gift.paymentId);
  const gst = await call(`/app/payments/${gift.paymentId}`, { token: A.token });
  assert.equal(gst.gift, true);
  const hF = await F.home();
  assert.equal(hF.subscription?.status, 'ACTIVE');
  assert.equal((await A.home()).subscription.expiresAt, before);
  ok(`gift: buyer paid, ${idF} got the subscription, buyer's own dates untouched; own ID refused`);

  // --- invite a friend: friend enters the inviter's Sali ID in «Промокод» ---
  const G = await device('G');
  await G.connect();
  const trialBefore = (await G.home()).trial.expiresAt;
  const ref = await call('/app/promo', { token: G.token, method: 'POST', body: { code: idA }, expect: [200, 201] });
  assert.equal(ref.kind, 'REFERRAL');
  assert.equal(ref.pending, false);
  const trialAfter = (await G.home()).trial.expiresAt;
  assert.equal(Date.parse(trialAfter) - Date.parse(trialBefore), ref.bonusHours * 3600e3);
  await call('/app/promo', { token: G.token, method: 'POST', body: { code: idF }, expect: 409 });
  await call('/app/promo', { token: A.token, method: 'POST', body: { code: idA }, expect: 400 });
  const refs = await call('/app/referrals', { token: A.token });
  assert.equal(refs.invited, 1);
  assert.equal(refs.availableDiscounts, 1);
  assert.equal(refs.code, idA);
  const plansA = await call('/app/plans', { token: A.token });
  assert.equal(plansA.discountPercent, refs.discountPercent);
  ok(`invite: friend got +${ref.bonusHours} h, inviter has a ${refs.discountPercent}% discount waiting; self-invite and second invite refused`);

  // Friend who enters an invite before ever pressing «Включить»: the bonus lands on first connect.
  const H = await device('H');
  const refH = await call('/app/promo', { token: H.token, method: 'POST', body: { code: idF }, expect: [200, 201] });
  assert.equal(refH.pending, true);
  await H.connect();
  const tH = (await H.home()).trial;
  assert.ok(tH.secondsRemaining > 24 * 3600 + 2.9 * 3600);
  ok('invite entered before the first connect: bonus added when the free 24 hours start');

  // --- devices: remove an old phone ---
  const hB0 = await B.home();
  const list = await call('/app/devices', { token: A.token });
  const other = list.devices.find((d) => !d.current);
  await call('/app/devices/remove', { token: A.token, method: 'POST', body: { key: list.devices.find((d) => d.current).key }, expect: 400 });
  await call('/app/devices/remove', { token: A.token, method: 'POST', body: { key: other.key }, expect: [200, 201] });
  assert.equal((await call('/app/devices', { token: A.token })).devices.length, 1);
  const hBafter = await B.home();
  assert.equal(hBafter.telegram.linked, false);
  assert.notEqual(hBafter.user.publicId, idA);
  ok(`device ${other.id} removed: it leaves the account (${hB0.user.publicId} → its own number); the current one can't remove itself`);

  // Relinking it does not change the account ID.
  await linkTo(B, hBafter, 222, 'alice');
  assert.equal((await B.home()).user.publicId, idA);
  assert.equal((await A.home()).user.publicId, idA);
  ok(`relinked: account ID still ${idA} (locked after the first adoption)`);

  // --- admin lookups and actions ---
  const card = await call('/app/admin/lookup', { token: ADM.token, method: 'POST', body: { query: idA }, expect: [200, 201] });
  assert.equal(card.kind, 'telegram');
  assert.equal(card.paidUsd, 21); // 3 + 15 (−50%) + 3 (gift)
  assert.equal(card.devices.length, 2);
  const byDevice = await call('/app/admin/lookup', { token: ADM.token, method: 'POST', body: { query: hA.device.id }, expect: [200, 201] });
  assert.equal(byDevice.kind, 'device');
  const people = await call('/app/admin/people?segment=paid&page=0', { token: ADM.token });
  assert.ok(people.counts.paid >= 2);
  const pays = await call('/app/admin/payments', { token: ADM.token });
  assert.equal(pays.length, 3);
  assert.equal(pays.find((p) => p.giftTo).giftTo, idF);
  const E2 = await E.home();
  await call('/app/admin/grant', { token: ADM.token, method: 'POST', body: { userId: E2.user.id, days: 30, kind: 'gift' }, expect: [200, 201] });
  assert.equal((await E.home()).subscription?.status, 'ACTIVE');
  await call('/app/admin/block', { token: ADM.token, method: 'POST', body: { userId: E2.user.id, isBlocked: true }, expect: [200, 201] });
  await call('/home', { token: E.token, expect: [200, 401, 403] });
  ok(`admin: lookup by Sali ID and by ${hA.device.id}, people, payments ($${card.paidUsd} from ${idA}), grant 30 days, block`);

  // --- the inviter's discount is spent on the next purchase ---
  const inv3 = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_monthly' }, expect: [200, 201] });
  assert.equal(inv3.discountPercent, 10);
  assert.equal(inv3.amount, '2.7');
  await pay(inv3.paymentId);
  assert.equal((await call('/app/referrals', { token: A.token })).availableDiscounts, 0);
  ok('referral discount: 2.7 USDT instead of 3, then used up');

  const week = await call('/app/purchase', { token: A.token, method: 'POST', body: { planCode: 'pro_7d' }, expect: [200, 201] });
  assert.equal(week.amount, '1.2');
  await pay(week.paymentId);
  ok('7-day tariff: 1.2 USDT invoice, paid, days added');

  // --- backup connection (Happ / v2RayTun / Hiddify) ---
  const bNo = await call('/app/backup', { token: D.token });
  assert.deepEqual(bNo, { enabled: true, linked: false });
  const bA = await call('/app/backup', { token: A.token });
  assert.equal(bA.access, true);
  assert.match(bA.url, /\/api\/v1\/sub\/[A-Za-z0-9_-]{20,}$/);
  assert.equal(bA.open.happ, `happ://add/${bA.url}`);
  assert.equal(bA.open.v2raytun, `v2raytun://import/${bA.url}`);
  assert.match(bA.open.hiddify, /^hiddify:\/\/import\/.+#Sali%20VPN$/);
  const bB = await call('/app/backup', { token: B.token });
  assert.equal(bB.url, bA.url);
  const bR = await call('/app/backup/reset', { token: A.token, method: 'POST', expect: [200, 201] });
  assert.notEqual(bR.url, bA.url);
  const refsText = (await call('/app/referrals', { token: A.token })).shareText;
  assert.match(refsText, /@SaliVpnNews/);
  assert.match(refsText, new RegExp(idA));
  ok(`backup: one link per account (both phones), deep links for Happ / v2RayTun / Hiddify, reset gives a new link; invite text has ${idA} and @SaliVpnNews`);

  // --- old app versions keep working (codes endpoint, home fields) ---
  await call('/codes/redeem', { token: A.token, method: 'POST', body: { code: 'SALI-AAAA-BBBB-CCCC' }, expect: 404 });
  ok('old app builds: /codes/redeem still answers');

  await db.end();
  console.log(`\nALL ${step} CHECKS PASSED`);
})().catch(async (error) => { console.error('✘ FAILED at step', step + 1, '\n', error); await db.end().catch(() => {}); process.exit(1); });
