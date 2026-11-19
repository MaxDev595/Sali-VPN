/* Sali VPN for Windows — UI. Same account model and features as the Android app:
   one Sali ID per account, free 3 days by pressing the power button, a subscription bought
   on the account that works on every device by itself. Talks to the main process only through window.sali. */
const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), publicId: $('publicId'), idChip: $('idChip'), idHint: $('idHint'), statusTitle: $('statusTitle'), statusSub: $('statusSub'),
  power: $('power'), timer: $('timer'), tariffStub: $('tariffStub'), accessMain: $('accessMain'), accessSub: $('accessSub'),
  server: $('server'), flag: $('flag'), getCode: $('getCode'), getCodeLabel: $('getCodeLabel'), enterCode: $('enterCode'),
  linkCard: $('linkCard'), linkBtn: $('linkBtn'), linkTitle: $('linkTitle'), linkHint: $('linkHint'),
  toast: $('toast'), support: $('support'), phone: $('phone'), version: $('version'), nav: $('nav'), navDrop: $('navDrop'), navAdmin: $('navAdmin'),
  rowTelegram: $('rowTelegram'), tgValue: $('tgValue'), tgHint: $('tgHint'), rowId: $('rowId'), rowIdValue: $('rowIdValue'), rowIdHint: $('rowIdHint'), rowAdmin: $('rowAdmin'),
  supportId: $('supportId'), faq: $('faq'), modal: $('modal'), modalBox: $('modalBox'), view: $('page-view'), admin: $('page-admin'),
  subDot: $('subDot'), subTitle: $('subTitle'), subHint: $('subHint'), subDevices: $('subDevices'), subDevicesText: $('subDevicesText'), subLink: $('subLink'),
  plansCard: $('plansCard'), plansTitle: $('plansTitle'), plansHint: $('plansHint'), discount: $('discount'), discountText: $('discountText'), discountClear: $('discountClear'),
  balanceValue: $('balanceValue'), balanceValue2: $('balanceValue2'), promoValue: $('promoValue'), devicesValue: $('devicesValue'), rowPromo: $('rowPromo'),
  devHead: $('devHead'), devList: $('devList'), devLink: $('devLink'),
};

let home = null;
let homeLoadedAt = 0;
let vpn = { state: 'disconnected', serverLocation: null, connectedAt: null };
let plansCache = null;
let promo = null; // { code, percent } — a discount promo waiting for the next payment

/* ---------- helpers ---------- */
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name, tone = 'p', cls = 'i') => `<img class="${cls}" src="assets/icons/${name}${tone ? `-${tone}` : ''}.png" alt="" />`;
const money = (usd) => `$${Number(usd).toFixed(Number(usd) % 1 ? 2 : 0)}`;
const usd2 = (v) => `$${Number(v || 0).toFixed(2)}`;
const period = (days) => (days >= 36000 ? 'Бессрочно' : days >= 360 && days <= 370 ? 'Год' : days >= 175 && days <= 185 ? 'Полгода' : `${days} ${days % 10 === 1 && days % 100 !== 11 ? 'день' : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20) ? 'дня' : 'дней'}`);
const dateRu = (iso, withYear = true) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }) : '—');
const dateTime = (iso) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const hoursLabel = (h) => (h % 24 === 0 ? period(h / 24).toLowerCase() : `${h} ч`);
const pad = (n) => String(n).padStart(2, '0');

class ApiErr extends Error { constructor(message, code, status) { super(message); this.code = code; this.status = status; } }
async function api(path, method = 'GET', body) {
  const r = await window.sali.api(path, method, body);
  if (!r.ok) throw new ApiErr(r.error || 'Не получилось', r.code, r.status);
  return r.data;
}

function toast(text, kind = '') {
  el.toast.textContent = text;
  el.toast.className = `toast ${kind}`;
  el.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.toast.hidden = true; }, 4200);
}
async function copy(text, done = 'Скопировано') { await window.sali.copy(text); toast(done, 'ok'); }

function hms(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const t = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((v) => pad(v)).join(':');
  return d > 0 ? `${d} д ${t}` : t;
}

/* modal: promo code, confirmations, forms */
function closeModal() { el.modal.hidden = true; el.modalBox.innerHTML = ''; }
function openModal(html, onReady) {
  el.modalBox.innerHTML = html;
  el.modal.hidden = false;
  onReady?.(el.modalBox);
  setTimeout(() => el.modalBox.querySelector('input')?.focus(), 60);
}
el.modal.addEventListener('click', (event) => { if (event.target === el.modal) closeModal(); });
function confirmBox(title, text, ok = 'Да', danger = false) {
  return new Promise((resolve) => {
    openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="sheet-actions"><button class="btn btn-ghost" data-no>Отмена</button><button class="btn ${danger ? 'btn-danger' : 'btn-peach'}" data-yes>${esc(ok)}</button></div>`, (box) => {
      box.querySelector('[data-no]').onclick = () => { closeModal(); resolve(false); };
      box.querySelector('[data-yes]').onclick = () => { closeModal(); resolve(true); };
    });
  });
}

/* ---------- account state ---------- */
const linkedNow = () => Boolean(home && (home.telegram ? home.telegram.linked : home.user && home.user.telegramLinked));
function access() {
  if (!home) return { kind: 'loading' };
  if (home.subscription && home.subscription.status === 'ACTIVE') return { kind: 'paid', until: home.subscription.expiresAt, plan: home.subscription.plan && home.subscription.plan.name };
  if (home.trial && home.trial.status === 'ACTIVE') {
    const left = home.trial.secondsRemaining - (Date.now() - homeLoadedAt) / 1000;
    if (left > 0) return { kind: 'trial', left };
  }
  return { kind: 'none', hadTrial: Boolean(home.trial) };
}
const forever = (iso) => (iso ? new Date(iso).getFullYear() > new Date().getFullYear() + 50 : false);

function render() {
  const a = access();
  const busy = vpn.state === 'connecting' || vpn.state === 'disconnecting';
  const on = vpn.state === 'connected';
  const linked = linkedNow();
  el.app.classList.toggle('is-connected', on);
  el.app.classList.toggle('is-connecting', vpn.state === 'connecting');
  el.app.classList.toggle('is-disconnecting', vpn.state === 'disconnecting');
  el.power.disabled = busy;

  el.statusTitle.textContent = on ? 'Соединение защищено' : vpn.state === 'connecting' ? 'Рисуем туннель…' : vpn.state === 'disconnecting' ? 'Отключаемся…' : 'VPN выключен';
  el.statusSub.textContent = vpn.detail || (on ? 'Весь трафик компьютера идёт через Sali' : busy ? ' '
    : a.kind === 'none' ? (a.hadTrial ? 'Бесплатные дни закончились — выберите тариф' : 'Нажмите на знак — первые 3 дня бесплатно')
      : 'Нажмите на знак, чтобы подключиться');
  el.power.setAttribute('aria-label', on ? 'Отключить VPN' : 'Подключить VPN');
  el.timer.textContent = on && vpn.connectedAt ? hms((Date.now() - vpn.connectedAt) / 1000) : ' ';

  el.tariffStub.className = 'stub' + (a.kind === 'none' ? ' none' : '');
  if (a.kind === 'paid') { el.accessMain.textContent = forever(a.until) ? 'Бессрочно' : a.until ? `до ${new Date(a.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : 'Подписка'; el.accessSub.textContent = 'Подписка аккаунта'; }
  else if (a.kind === 'trial') { el.accessMain.innerHTML = `<span class="mono">${hms(a.left)}</span>`; el.accessSub.textContent = 'Бесплатно'; }
  else if (a.kind === 'none') { el.accessMain.textContent = a.hadTrial ? 'Выбрать' : '3 дня'; el.accessSub.textContent = a.hadTrial ? 'Нет подписки' : 'бесплатно — нажмите «Включить»'; }
  else { el.accessMain.textContent = '—'; el.accessSub.textContent = 'Проверяем доступ…'; }
  el.getCodeLabel.textContent = a.kind === 'paid' ? 'Продлить' : 'Тарифы';

  el.server.textContent = vpn.serverLocation || 'Автовыбор';
  el.flag.src = `assets/flags/${flagFor(vpn.serverLocation)}.png`;

  el.linkCard.hidden = !home || linked || !(linkStarted || (a.kind === 'none' && a.hadTrial));
  el.linkTitle.textContent = linkStarted ? 'Бот не ответил?' : 'Привяжите Telegram';
  el.linkHint.textContent = linkStarted ? 'В Telegram нажмите «Запустить». Если бот молчит — вставьте ему скопированный номер.' : 'Нужно только для оплаты: подписка начисляется на аккаунт и работает на всех устройствах.';
  el.linkBtn.textContent = linkStarted ? 'Открыть бота' : 'Привязать';

  const id = home && home.user ? home.user.publicId : '—';
  el.publicId.textContent = home ? id : 'SL-····-····';
  el.idHint.textContent = home && home.device ? `этот ПК: ${home.device.id} · копировать` : 'копировать';
  el.supportId.textContent = id;
  el.rowIdValue.textContent = id;
  el.rowIdHint.textContent = home && home.device ? `Один на аккаунт. Этот компьютер — ${home.device.id}` : 'Один на аккаунт — на всех устройствах';
  el.tgValue.textContent = !home ? '—' : linked ? (home.telegram && home.telegram.username ? `@${home.telegram.username}` : 'Привязан') : 'Привязать';
  el.tgHint.textContent = linked ? 'Подписки и подарки начисляются на этот аккаунт' : 'Нужно только для оплаты подписки';
  const admin = Boolean(home && home.isAdmin);
  el.navAdmin.hidden = !admin; el.rowAdmin.hidden = !admin;

  renderSub(a);
}

const FLAGS = [[/nether|нидерл|amster|амстер/i, 'nl'], [/german|герман|frank|франкф|berlin|берлин/i, 'de'], [/usa|united states|сша|new york|нью-йорк/i, 'us'], [/finl|финл|helsin|хельсин/i, 'fi'],
  [/fran|франц|paris|париж/i, 'fr'], [/united kingdom|britain|англи|британ|london|лондон/i, 'gb'], [/pol|польш|warsaw|варшав/i, 'pl'], [/swed|швец|stockh|стокгол/i, 'se'], [/turk|турц|istanb|стамбул/i, 'tr'],
  [/kazakh|казах|almaty|алматы|astana|астана/i, 'kz'], [/japan|япон|tokyo|токио/i, 'jp'], [/singap|сингап/i, 'sg'], [/switz|швейц|zurich|цюрих/i, 'ch'], [/austria|австри|vienna|вена/i, 'at'], [/canad|канад/i, 'ca'], [/norw|норвег/i, 'no']];
const flagFor = (location) => (FLAGS.find(([re]) => re.test(location || '')) || [null, 'globe'])[1];

/* «Подписка» tab */
function renderSub(a) {
  if (!home) return;
  const linked = linkedNow();
  const until = (home.subscription && home.subscription.expiresAt) || (home.account && home.account.until) || null;
  const s = a.kind === 'paid' ? { title: forever(until) ? 'Подписка бессрочная' : `Подписка до ${dateRu(until, false)}`, hint: 'Работает на всех устройствах аккаунта', tone: 'ok' }
    : a.kind === 'trial' ? { title: 'Бесплатные 3 дня', hint: `До ${dateTime(home.trial.expiresAt)}`, tone: 'accent' }
      : a.hadTrial ? { title: 'Бесплатное время закончилось', hint: 'Выберите тариф — VPN заработает сразу', tone: 'warn' }
        : { title: 'Нет подписки', hint: 'Первые 3 дня — бесплатно: нажмите «Включить» на вкладке VPN', tone: 'muted' };
  el.subTitle.textContent = s.title; el.subHint.textContent = s.hint; el.subDot.className = `dot ${s.tone}`;
  const acc = home.account;
  el.subDevices.hidden = !acc;
  el.subDevicesText.textContent = acc ? `${acc.used}/${acc.max}` : '';
  el.devicesValue.textContent = acc ? `${acc.used} из ${acc.max}` : '1 из 3';
  el.balanceValue.textContent = usd2(home.balanceUsd); el.balanceValue2.textContent = usd2(home.balanceUsd);
  if (el.subLink.dataset.linked !== String(linked)) { el.subLink.dataset.linked = String(linked); el.subLink.innerHTML = linked ? '' : linkCardHtml(); bindLinkCards(el.subLink); }
  const percent = Math.max(promo ? promo.percent : 0, plansCache ? plansCache.discountPercent : 0);
  el.discount.hidden = !percent;
  el.discountText.textContent = promo && promo.percent >= (plansCache ? plansCache.discountPercent : 0) ? `Промокод ${promo.code}: −${promo.percent}% на следующую оплату` : `Скидка за приглашённого друга: −${percent}%`;
  el.discountClear.hidden = !promo;
  el.promoValue.textContent = promo ? `−${promo.percent}%` : '';
  if (plansCache && plansCache.plans.length) {
    const main = plansCache.plans.find((p) => p.durationDays === 30);
    el.plansTitle.textContent = `${plansCache.plans.length} тарифов — от ${money(Math.min(...plansCache.plans.map((p) => p.priceUsd)))}`;
    el.plansHint.textContent = main ? `Основная подписка — ${money(main.priceUsd)} за 30 дней` : 'От 7 дней до года';
  }
}

function linkCardHtml() {
  return `<div class="tg-card">${icon('telegram')}<div><b>Привяжите Telegram</b><span>Одно нажатие: откроется бот, нажмите «Запустить» — аккаунт привяжется сам. Нужно только для оплаты: подписка начисляется на аккаунт и работает на всех ваших устройствах.</span></div><button class="btn btn-peach" data-link>Привязать</button></div>`;
}
function bindLinkCards(root) { root.querySelectorAll('[data-link]').forEach((b) => { b.onclick = linkToBot; }); }

async function loadHome({ quiet = false } = {}) {
  const response = await window.sali.home();
  if (response.ok) { home = response.home; homeLoadedAt = Date.now(); }
  else if (!quiet) { el.statusSub.textContent = response.error; toast(response.error, 'err'); }
  render();
  return home;
}
async function loadPlans() {
  try { plansCache = await api('/app/plans'); } catch { /* shown on the tariffs screen */ }
  render();
  return plansCache;
}

/* ---------- VPN ---------- */
async function togglePower() {
  if (el.power.disabled) return;
  if (vpn.state === 'connected') { await window.sali.disconnect(); return; }
  // The server decides: free 3 days, the account's subscription (shared by every device) or «choose a tariff».
  const result = await window.sali.connect();
  if (!result.ok) {
    if (result.status === 403) { toast(result.error, 'err'); go('sub'); }
    else toast(`${result.error} — если повторяется, напишите в поддержку.`, 'err');
  }
  void loadHome({ quiet: true });
}
el.power.addEventListener('click', () => void togglePower());
window.sali.onVpnState((payload) => {
  vpn = { ...vpn, state: payload.state, detail: payload.detail, serverLocation: payload.serverLocation ?? vpn.serverLocation };
  if (payload.state === 'connected' && !vpn.connectedAt) vpn.connectedAt = Date.now();
  if (payload.state === 'disconnected') vpn.connectedAt = null;
  render();
});

/* ---------- navigation ---------- */
const pages = [...document.querySelectorAll('.page')];
const tabs = [...el.nav.querySelectorAll('button[data-page]')];
let current = 'vpn';
let tabOf = 'vpn';
let stack = []; // inner screens: [{ name, params }]
function show(name) {
  const from = pages.find((page) => page.dataset.page === current);
  const to = pages.find((page) => page.dataset.page === name);
  if (!to) return;
  if (from === to) { to.classList.remove('enter'); void to.offsetWidth; to.classList.add('enter'); to.scrollTop = 0; return; }
  current = name;
  from.classList.remove('enter'); from.classList.add('leave');
  setTimeout(() => {
    from.hidden = true; from.classList.remove('leave');
    to.hidden = false; to.scrollTop = 0;
    to.classList.remove('enter'); void to.offsetWidth; to.classList.add('enter');
  }, 160);
}
function selectTab(name) {
  const tab = tabs.find((button) => button.dataset.page === name);
  if (!tab || tabOf === name) return;
  pour(tabs.find((button) => button.dataset.page === tabOf), tab);
  tabOf = name;
}
function go(name) {
  stack = [];
  selectTab(name);
  show(name);
  if (name === 'devices') void loadDevices();
  if (name === 'sub') { void loadHome({ quiet: true }); void loadPlans(); }
  if (name === 'admin') void renderAdminHome();
}
tabs.forEach((button) => button.addEventListener('click', () => go(button.dataset.page)));

function open(name, params = {}, parent) {
  if (parent) { selectTab(parent); }
  stack.push({ name, params });
  void renderView();
}
function back() {
  stack.pop();
  if (stack.length) void renderView(); else show(tabOf);
}
const VIEWS = {};
async function renderView() {
  const top = stack[stack.length - 1];
  const view = VIEWS[top.name];
  el.view.innerHTML = `<button class="back" id="viewBack">${icon('chevron', 'm', 'i flip')}Назад</button><div id="viewBody"></div>`;
  $('viewBack').onclick = back;
  show('view');
  await view($('viewBody'), top.params);
}
function head(title, sub) { return `<header class="page-head"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</header>`; }
const loading = '<div class="loading"><span></span><span></span><span></span></div>';
const errorNote = (text) => `<div class="note err">${icon('info', 'r')}<span>${esc(text)}</span></div>`;

/* The peach colour leaves the old icon as a drop, slides along the menu and pours into the new icon. */
function paintNav() { tabs.forEach((b) => { const img = b.querySelector('img.ni'); img.src = `assets/icons/${img.dataset.icon}-${b.getAttribute('aria-selected') === 'true' ? 'p' : 'm'}.png`; }); }
function pour(fromTab, toTab) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = (button) => button.offsetTop + button.offsetHeight / 2;
  const select = () => { tabs.forEach((button) => button.setAttribute('aria-selected', String(button === toTab))); paintNav(); toTab.classList.remove('pour'); void toTab.offsetWidth; toTab.classList.add('pour'); };
  if (!fromTab || fromTab === toTab || reduce || !el.navDrop.animate) { select(); return; }
  fromTab.setAttribute('aria-selected', 'false'); paintNav();
  const a = y(fromTab); const b = y(toTab); const stretch = 1 + Math.min(1.8, Math.abs(b - a) / 44 * .8);
  const drop = el.navDrop.animate([
    { opacity: 0, transform: `translateY(${a}px) scale(.4)` },
    { opacity: 1, transform: `translateY(${a}px) scale(1)`, offset: .18 },
    { opacity: 1, transform: `translateY(${(a + b) / 2}px) scale(.75, ${stretch})`, offset: .55 },
    { opacity: 1, transform: `translateY(${b}px) scale(1)`, offset: .86 },
    { opacity: 0, transform: `translateY(${b}px) scale(.4)` },
  ], { duration: 520, easing: 'cubic-bezier(.45, 0, .2, 1)' });
  setTimeout(select, 430);
  drop.onfinish = () => drop.cancel();
}
paintNav();

/* ---------- Telegram linking: one tap, the bot answers «аккаунт привязан» ---------- */
let linkStarted = false;
let linkWatch = null;
function linkToBot() {
  if (!home) return;
  const code = (home.device && home.device.linkCode) || home.user.publicId;
  const id = code.replace(/[^0-9A-Z]/gi, '').replace(/^SL/i, '');
  void window.sali.copy(code);
  void window.sali.openBot(`link_${id}`);
  linkStarted = true; render();
  toast('В Telegram нажмите «Запустить» — аккаунт привяжется сам. Номер скопирован: если бот молчит, вставьте его в чат.', 'ok');
  clearInterval(linkWatch);
  const started = Date.now();
  linkWatch = setInterval(async () => {
    await loadHome({ quiet: true });
    if (linkedNow() || Date.now() - started > 120000) {
      clearInterval(linkWatch); linkStarted = false; render();
      if (linkedNow()) { toast('Аккаунт привязан! Подписка аккаунта работает и на этом компьютере.', 'ok'); void loadPlans(); if (current === 'view') void renderView(); if (current === 'devices') void loadDevices(); }
    }
  }, 3000);
}
el.linkBtn.addEventListener('click', () => (linkStarted ? void window.sali.openBot() : linkToBot()));

/* ---------- promo ---------- */
function openPromo() {
  openModal(`<h2>${icon('tag', 'p', 'h-ico')}Промокод</h2><p>Промокод или Sali ID друга, который вас пригласил.</p>
    <div class="code-field"><input id="promoInput" spellcheck="false" placeholder="Например, SALI2026" maxlength="40" /><button type="button" class="btn-small" id="promoPaste">Вставить</button></div>
    <p class="form-error" id="promoErr" hidden></p>
    <div class="sheet-actions"><button class="btn btn-ghost" id="promoCancel">Отмена</button><button class="btn btn-peach" id="promoApply">Применить</button></div>`, (box) => {
    const input = box.querySelector('#promoInput'); const err = box.querySelector('#promoErr'); const apply = box.querySelector('#promoApply');
    input.oninput = () => { input.value = input.value.toUpperCase().replace(/\s/g, ''); err.hidden = true; };
    input.onkeydown = (e) => { if (e.key === 'Enter') apply.click(); };
    box.querySelector('#promoPaste').onclick = async () => { input.value = String(await window.sali.readClipboard()).toUpperCase().trim().slice(0, 40); input.focus(); };
    box.querySelector('#promoCancel').onclick = closeModal;
    apply.onclick = async () => {
      const code = input.value.trim();
      if (code.length < 3) { err.textContent = 'Введите промокод'; err.hidden = false; return; }
      apply.disabled = true; apply.textContent = 'Проверяем…';
      try {
        const r = await api('/app/promo', 'POST', { code });
        closeModal();
        if (r.kind === 'DISCOUNT') { promo = { code: r.code, percent: r.percent }; toast(`Скидка ${r.percent}% — на следующую оплату`, 'ok'); }
        else if (r.kind === 'DAYS') toast(`Начислено ${period(r.days).toLowerCase()} подписки`, 'ok');
        else toast(r.pending ? `Приглашение принято: +${hoursLabel(r.bonusHours)} — добавится, когда включите VPN` : `Приглашение принято: +${hoursLabel(r.bonusHours)}`, 'ok');
        await loadHome({ quiet: true });
      } catch (e) { err.textContent = e.message; err.hidden = false; apply.disabled = false; apply.textContent = 'Применить'; }
    };
  });
}
el.enterCode.addEventListener('click', openPromo);
el.rowPromo.addEventListener('click', openPromo);
el.discountClear.addEventListener('click', () => { promo = null; render(); });

/* ---------- Тарифы ---------- */
const promiseCards = `<div class="promises">
  <div class="promise">${icon('bolt', 'd', 'pi')}<div><b>Быстрая сеть</b><span>Современный протокол и серверы без перегрузки — видео, игры и звонки без задержек.</span></div></div>
  <div class="promise">${icon('lock', 'd', 'pi')}<div><b>Конфиденциальность превыше всего</b><span>Не храним историю посещений и не показываем рекламу. Аккаунт — только Sali ID.</span></div></div>
</div>`;
VIEWS.plans = async (root) => {
  root.innerHTML = head('Тарифы', 'Любой тариф — все страны и до 3 устройств. Отличается только срок.') + promiseCards + (linkedNow() ? '' : linkCardHtml()) + `<div id="planList">${loading}</div>`;
  bindLinkCards(root);
  const data = await loadPlans();
  const list = root.querySelector('#planList');
  if (!data) { list.innerHTML = errorNote('Не удалось загрузить тарифы. Проверьте интернет.'); return; }
  const percent = Math.max(promo ? promo.percent : 0, data.discountPercent || 0);
  const price = (p) => (percent ? Math.round(p.priceUsd * (100 - percent)) / 100 : p.priceUsd);
  const base = data.plans.find((p) => p.durationDays === 30);
  const saving = (p) => (base && p.durationDays > 30 ? Math.round((1 - p.perMonthUsd / base.perMonthUsd) * 100) : 0);
  const best = data.plans.reduce((top, p) => (saving(p) > (top ? saving(top) : 0) ? p : top), null);
  list.innerHTML = `<div class="plan-grid">${data.plans.map((p) => {
    const now = price(p); const main = p.durationDays === 30; const off = saving(p);
    return `<button class="plan${main ? ' main' : ''}" data-plan="${esc(p.code)}">
      <span class="plan-top"><b>${esc(period(p.durationDays))}</b>${main ? `<em class="badge-main">${icon('star', 'd')}ОСНОВНОЙ</em>` : p === best && off > 0 ? `<em class="badge-best">ВЫГОДНО −${off}%</em>` : ''}</span>
      <span class="plan-desc">${esc(p.description || p.name)}</span>
      ${p.durationDays > 30 ? `<span class="plan-per">${money(p.perMonthUsd)} за 30 дней${off > 0 ? ` · экономия ${off}%` : ''}</span>` : '<span class="plan-per">&nbsp;</span>'}
      <span class="plan-price"><b>${money(now)}</b>${now !== p.priceUsd ? `<s>${money(p.priceUsd)}</s>` : '<small>USDT</small>'}</span>
    </button>`;
  }).join('')}</div>${percent ? `<div class="discount">${icon('check', 'g')}<span>${promo && promo.percent >= (data.discountPercent || 0) ? `Промокод ${esc(promo.code)}: −${promo.percent}%` : `Скидка за приглашённого друга: −${data.discountPercent}%`} — цены уже со скидкой</span></div>` : ''}
  <p class="fine">Оплата — USDT в сети TON. Подписка начисляется на аккаунт и сразу работает на всех ваших устройствах.</p>`;
  list.querySelectorAll('[data-plan]').forEach((b) => { b.onclick = () => (linkedNow() ? open('checkout', { plan: b.dataset.plan }) : linkToBot()); });
};

/* ---------- Оплата (USDT TON), с баланса ---------- */
let payTimer = null;
VIEWS.checkout = async (root, params) => {
  clearInterval(payTimer);
  root.innerHTML = head(params.topup ? 'Пополнение баланса' : 'Оплата', params.gift ? `Подарок для ${params.gift}` : params.topup ? `${usd2(params.topup)} на баланс Sali` : 'Для вашего аккаунта') + `<div id="co">${loading}</div>`;
  const co = root.querySelector('#co');
  const fail = (e) => {
    if (e && e.code === 'TELEGRAM_REQUIRED') { co.innerHTML = errorNote(e.message) + linkCardHtml(); bindLinkCards(co); return; }
    if (e && promo && /промокод/i.test(e.message)) promo = null;
    co.innerHTML = errorNote(e ? e.message : 'Не удалось выставить счёт') + '<button class="btn btn-ghost" id="coRetry">Попробовать снова</button>';
    co.querySelector('#coRetry').onclick = () => void renderView();
  };
  const success = (title, text, button, action) => {
    co.innerHTML = `<div class="success">${icon('check', 'd', 'ok-ico')}<h3>${esc(title)}</h3><p>${esc(text)}</p><button class="btn btn-peach" id="coDone">${esc(button)}</button></div>`;
    co.querySelector('#coDone').onclick = action;
  };
  const toVpn = () => go('vpn');
  const invoice = async () => {
    co.innerHTML = loading;
    let inv;
    try { inv = params.topup ? await api('/app/balance/topup', 'POST', { amountUsd: Number(params.topup) }) : await api('/app/purchase', 'POST', { planCode: params.plan, ...(params.gift ? { giftTo: params.gift } : {}), ...(promo ? { promo: promo.code } : {}) }); }
    catch (e) { fail(e); return; }
    const expires = Date.parse(inv.expiresAt);
    co.innerHTML = `<div class="invoice">
      <div class="inv-sum"><small>К ОПЛАТЕ</small><b>${esc(inv.amount)} ${esc(inv.asset)}</b><span>Сеть ${esc(inv.network)}${inv.discountPercent ? ` · скидка ${inv.discountPercent}%` : ''}${inv.plan && !inv.topup ? ` · ${esc(period(inv.plan.durationDays))}` : ''}</span></div>
      <button class="copybox" data-copy="${esc(inv.address)}"><small>АДРЕС КОШЕЛЬКА</small><b class="addr">${esc(inv.address)}</b>${icon('copy')}</button>
      <button class="copybox" data-copy="${esc(inv.comment)}"><small>КОММЕНТАРИЙ — ОБЯЗАТЕЛЬНО</small><b>${esc(inv.comment)}</b>${icon('copy')}</button>
      <button class="copybox" data-copy="${esc(inv.amount)}"><small>СУММА</small><b>${esc(inv.amount)}</b>${icon('copy')}</button>
      <div class="inv-actions">${inv.tonUrl || inv.tonkeeperUrl ? '<button class="btn btn-peach" id="wallet">Открыть кошелёк</button>' : ''}<span class="inv-timer" id="invTimer"></span></div>
      <p class="fine">Переведите ровно эту сумму USDT в сети TON с комментарием — без него платёж не найдётся. Мы увидим перевод сами, обычно за минуту. ${inv.topup ? 'Деньги придут на баланс Sali.' : 'Подписка начислится на аккаунт и заработает на всех устройствах.'}</p>
      <div class="waiting"><span class="spin"></span>Ждём перевод…</div>
    </div>`;
    co.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => void copy(b.dataset.copy); });
    const wallet = co.querySelector('#wallet');
    if (wallet) wallet.onclick = async () => { for (const u of [inv.tonUrl, inv.tonkeeperUrl].filter(Boolean)) { if (await window.sali.openUrl(u)) return; } toast('Кошелёк не открылся — скопируйте адрес и комментарий', 'err'); };
    const tick = async () => {
      if (!document.body.contains(co)) { clearInterval(payTimer); return; }
      const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      const t = co.querySelector('#invTimer'); if (t) t.textContent = left ? `Счёт действует ${pad(Math.floor(left / 60))}:${pad(left % 60)}` : 'Счёт истёк';
    };
    let n = 0;
    payTimer = setInterval(async () => {
      void tick();
      if (++n % 5) return;
      const st = await api(`/app/payments/${inv.paymentId}`).catch(() => null);
      if (!st || !document.body.contains(co)) return;
      if (st.status === 'SUCCEEDED') {
        clearInterval(payTimer);
        await loadHome({ quiet: true });
        if (st.topup) success(`+${usd2(st.amountUsd)} на балансе`, `Теперь на балансе ${usd2(st.balanceUsd)}. Оплачивайте тарифы в одно нажатие или включите автопродление.`, 'К балансу', back);
        else { if (promo) promo = null; success(st.gift ? 'Подарок оплачен' : 'Оплачено', st.gift ? 'Подписка уже на аккаунте друга.' : `Подписка до ${dateRu(st.until)} — работает на всех ваших устройствах.`, st.gift ? 'Готово' : 'Включить VPN', toVpn); }
      } else if (st.status === 'FAILED' || (st.expired && st.status === 'PENDING')) {
        clearInterval(payTimer);
        co.querySelector('.waiting').innerHTML = 'Счёт истёк. <button class="link" id="again">Выставить новый</button>';
        co.querySelector('#again').onclick = () => void invoice();
      }
    }, 1000);
    void tick();
  };
  if (params.topup) return invoice();
  // Enough on the balance → let the customer choose; otherwise straight to the invoice.
  const [b, p] = await Promise.all([api('/app/balance').catch(() => null), loadPlans()]);
  const plan = p && p.plans.find((x) => x.code === params.plan);
  const percent = Math.max(promo ? promo.percent : 0, p ? p.discountPercent : 0);
  const price = plan ? Math.round(plan.priceUsd * (100 - percent)) / 100 : 0;
  if (!(b && b.linked && plan && b.balanceUsd >= price)) return invoice();
  co.innerHTML = `<div class="choice">
    <div class="card accent"><small>ТАРИФ</small><b>${esc(period(plan.durationDays))} · ${money(price)}</b><span>На балансе ${usd2(b.balanceUsd)}</span></div>
    <button class="btn btn-peach" id="payBalance">${icon('cash', 'd')}Оплатить с баланса — ${money(price)}</button>
    <button class="btn btn-ghost" id="payUsdt">Перевести USDT</button></div>`;
  co.querySelector('#payUsdt').onclick = () => void invoice();
  co.querySelector('#payBalance').onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      const r = await api('/app/balance/pay', 'POST', { planCode: params.plan, ...(params.gift ? { giftTo: params.gift } : {}), ...(promo ? { promo: promo.code } : {}) });
      if (promo) promo = null;
      await loadHome({ quiet: true });
      success(r.gift ? 'Подарок оплачен' : `${r.plan} активна`, `Списано ${usd2(r.priceUsd)} с баланса, осталось ${usd2(r.balanceUsd)}.${r.gift ? '' : ` Подписка до ${dateRu(r.until)}.`}`, r.gift ? 'Готово' : 'Включить VPN', toVpn);
    } catch (e) { fail(e); }
  };
};

/* ---------- Баланс ---------- */
VIEWS.balance = async (root) => {
  root.innerHTML = head('Баланс', 'Пополните один раз — и оплачивайте тарифы в одно нажатие или включите автопродление.') + `<div id="bal">${loading}</div>`;
  const box = root.querySelector('#bal');
  let info; let plans = [];
  try { [info, plans] = await Promise.all([api('/app/balance'), loadPlans().then((p) => (p ? p.plans : []))]); } catch (e) { box.innerHTML = errorNote(e.message); return; }
  if (!info.linked) { box.innerHTML = '<p class="muted">Баланс хранится на аккаунте, поэтому сначала привяжите Telegram — это одно нажатие.</p>' + linkCardHtml(); bindLinkCards(box); return; }
  const renewPlan = plans.find((p) => p.code === (info.autoRenew ? info.autoRenew.planCode : 'pro_monthly')) || plans.find((p) => p.durationDays === 30);
  const kindIcon = (t) => (t.kind === 'TOPUP' || t.kind === 'ADMIN' ? 'plus' : t.kind === 'GIFT' ? 'gift' : t.kind === 'REFUND' ? 'cash' : 'key');
  box.innerHTML = `<div class="bal-grid">
    <div class="hero-card"><small>НА БАЛАНСЕ</small><b>${usd2(info.balanceUsd)}</b><span>${info.autoRenew && info.nextRenewalAt ? `Следующее продление ${dateRu(info.nextRenewalAt, false)} · ${money(info.autoRenew.priceUsd)}` : info.subscriptionUntil ? `Подписка до ${dateRu(info.subscriptionUntil, false)}` : 'Пополняется переводом USDT (сеть TON)'}</span>
      <button class="btn btn-ghost" id="payPlan">Оплатить тариф с баланса</button></div>
    <div class="card"><h4>Пополнить</h4><div class="chips">${[3, 5, 10, 30].map((v) => `<button class="chip" data-top="${v}">$${v}</button>`).join('')}</div>
      <div class="code-field"><input id="topAmount" placeholder="Другая сумма, от $${info.minTopUpUsd}" maxlength="7" /><button class="btn-small" id="topGo">Пополнить</button></div></div>
  </div>
  <p class="label">${icon('key')}АВТОПРОДЛЕНИЕ</p>
  <div class="card"><div class="toggle-row"><div><b>${info.autoRenew ? `${esc(period(info.autoRenew.durationDays))} за ${money(info.autoRenew.priceUsd)}` : 'Выключено'}</b><span>За сутки до конца подписки спишем стоимость тарифа с баланса. Не хватит — напомним в Telegram.</span></div><button class="switch${info.autoRenew ? ' on' : ''}" id="renew" aria-label="Автопродление"><i></i></button></div>
    ${info.autoRenew ? `<div class="chips">${plans.map((p) => `<button class="chip${info.autoRenew.planCode === p.code ? ' on' : ''}" data-renew="${esc(p.code)}">${esc(period(p.durationDays))} · ${money(p.priceUsd)}</button>`).join('')}</div>` : ''}</div>
  <p class="label">${icon('info')}ИСТОРИЯ</p>
  <div class="tx-list">${info.history.length ? info.history.map((t) => `<div class="tx">${icon(kindIcon(t), t.amountUsd > 0 ? 'g' : 'p', 'tx-ico')}<div><b>${esc(t.label)}</b><small>${esc(dateTime(t.at))}${t.note ? ` · ${esc(t.note)}` : ''}</small></div><em class="${t.amountUsd > 0 ? 'plus' : ''}">${t.amountUsd > 0 ? '+' : '−'}${usd2(Math.abs(t.amountUsd))}</em></div>`).join('') : '<p class="muted">Пока пусто</p>'}</div>
  <p class="fine">Деньги на балансе тратятся только на Sali VPN и не выводятся. Нужен возврат — напишите в поддержку: вернём на кошелёк, с которого пришёл перевод.</p>`;
  box.querySelector('#payPlan').onclick = () => open('plans');
  box.querySelectorAll('[data-top]').forEach((b) => { b.onclick = () => open('checkout', { topup: Number(b.dataset.top).toFixed(2) }); });
  const amount = box.querySelector('#topAmount');
  amount.oninput = () => { amount.value = amount.value.replace(/[^0-9.,]/g, '').slice(0, 7); };
  box.querySelector('#topGo').onclick = () => {
    const v = Number(amount.value.replace(',', '.'));
    if (!(v >= info.minTopUpUsd && v <= info.maxTopUpUsd)) { toast(`Сумма от $${info.minTopUpUsd} до $${info.maxTopUpUsd}`, 'err'); return; }
    open('checkout', { topup: v.toFixed(2) });
  };
  const setRenew = async (code) => {
    try { await api('/app/balance/auto-renew', 'POST', { planCode: code }); toast(code ? 'Автопродление включено' : 'Автопродление выключено', 'ok'); void renderView(); }
    catch (e) { toast(e.message, 'err'); }
  };
  box.querySelector('#renew').onclick = () => void setRenew(info.autoRenew ? null : (renewPlan ? renewPlan.code : 'pro_monthly'));
  box.querySelectorAll('[data-renew]').forEach((b) => { b.onclick = () => void setRenew(b.dataset.renew); });
};

/* ---------- Подарок ---------- */
VIEWS.gift = async (root) => {
  root.innerHTML = head('Подарить подписку', 'Попросите у друга его Sali ID — он в приложении Sali VPN. Подписка сразу появится на его аккаунте.') + (linkedNow() ? '' : linkCardHtml()) + `
    <div class="card narrow"><label class="field-label">Sali ID друга</label>
    <div class="code-field"><input id="giftId" spellcheck="false" placeholder="SL-XXXX-XXXX" maxlength="12" /><button class="btn-small" id="giftCheck">Проверить</button></div>
    <p class="form-error" id="giftErr" hidden></p><div id="giftNext"></div></div>`;
  bindLinkCards(root);
  const input = root.querySelector('#giftId'); const err = root.querySelector('#giftErr'); const next = root.querySelector('#giftNext');
  input.oninput = () => { const raw = input.value.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^SL/, '').slice(0, 8); input.value = raw ? `SL-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ''}` : ''; next.innerHTML = ''; err.hidden = true; };
  input.onkeydown = (e) => { if (e.key === 'Enter') root.querySelector('#giftCheck').click(); };
  root.querySelector('#giftCheck').onclick = async () => {
    if (input.value.replace(/[^0-9A-Z]/g, '').length < 10) { err.textContent = 'Введите Sali ID полностью: SL-XXXX-XXXX'; err.hidden = false; return; }
    try {
      const to = await api('/app/gift/check', 'POST', { code: input.value });
      const p = await loadPlans();
      let plan = p && p.plans[0] ? p.plans[0].code : null;
      next.innerHTML = `<div class="card accent"><small>ПОЛУЧАТЕЛЬ</small><b>${esc(to.to)}${to.name ? ` · ${esc(to.name)}` : ''}</b></div><h4>Что подарить</h4>
        <div class="radios">${(p ? p.plans : []).map((x, i) => `<button class="radio${i === 0 ? ' on' : ''}" data-gplan="${esc(x.code)}"><i></i><b>${esc(period(x.durationDays))}</b><em>${money(x.priceUsd)}</em></button>`).join('')}</div>
        <button class="btn btn-peach" id="giftPay">Перейти к оплате</button>`;
      next.querySelectorAll('[data-gplan]').forEach((b) => { b.onclick = () => { plan = b.dataset.gplan; next.querySelectorAll('[data-gplan]').forEach((o) => o.classList.toggle('on', o === b)); }; });
      next.querySelector('#giftPay').onclick = () => (linkedNow() ? open('checkout', { plan, gift: to.to }) : linkToBot());
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  };
};

/* ---------- Пригласить друга ---------- */
VIEWS.invite = async (root) => {
  root.innerHTML = head('Пригласить друга') + `<div id="inv">${loading}</div>`;
  const box = root.querySelector('#inv');
  let d; try { d = await api('/app/referrals'); } catch (e) { box.innerHTML = errorNote(e.message); return; }
  root.querySelector('.page-head').insertAdjacentHTML('beforeend', `<p>Друг получит +${esc(hoursLabel(d.friendBonusHours))} бесплатно, а вы — скидку ${d.discountPercent}% на следующую оплату за каждого друга.</p>`);
  box.innerHTML = `<div class="inv-grid"><div>
    <button class="copybox big" data-copy="${esc(d.code)}"><small>ВАШ КОД ПРИГЛАШЕНИЯ</small><b>${esc(d.code)}</b>${icon('copy')}</button>
    <p class="fine">Друг вводит его в приложении: «Подписка» → «Промокод»</p>
    <button class="btn btn-peach" id="share">${icon('copy', 'd')}Скопировать сообщение для друга</button>
    ${d.channel ? `<button class="channel" data-url="${esc(d.channel)}">${icon('megaphone', 'p', 'ch-ico')}<div><b>Наш канал ${esc(d.channelTag || '')}</b><span>Новости, акции и промокоды — подпишитесь сами и позовите друзей</span></div>${icon('external', 'p')}</button>` : ''}
    <div class="stats"><div class="stat"><small>Друзей пришло</small><b>${d.invited}</b></div><div class="stat"><small>Скидок ждут оплаты</small><b>${d.availableDiscounts}</b>${d.availableDiscounts ? `<span>−${d.discountPercent}% к следующей оплате</span>` : ''}</div></div>
  </div><div>
    <p class="label first">ДРУГ ПОЛУЧИТ ТАКОЕ СООБЩЕНИЕ</p><div class="bubble">${esc(d.shareText)}</div>
    <div class="card"><h4>Как это работает</h4><p class="muted">1. Друг скачивает Sali VPN и нажимает «Включить» — 3 дня бесплатно.<br />2. Вводит ваш код в «Промокод» — получает ещё +${esc(hoursLabel(d.friendBonusHours))}.<br />3. Вам начисляется скидка ${d.discountPercent}% на следующую оплату.</p></div>
  </div></div>`;
  box.querySelector('[data-copy]').onclick = () => void copy(d.code, 'Код скопирован');
  box.querySelector('#share').onclick = () => void copy(d.shareText, 'Сообщение скопировано — отправьте его другу');
  bindUrls(box);
};

/* ---------- Запасное подключение ---------- */
const WIN_APPS = { happ: 'https://www.happ.su/', v2raytun: 'https://v2raytun.com/', hiddify: 'https://hiddify.com/' };
VIEWS.backup = async (root) => {
  root.innerHTML = head('Запасное подключение', 'Если в какой-то сети Sali VPN не подключается — включите запасной вариант. Подписка та же, платить отдельно не нужно.') + `<div id="bk">${loading}</div>`;
  const box = root.querySelector('#bk');
  let d; try { d = await api('/app/backup'); } catch (e) { box.innerHTML = errorNote(e.message); return; }
  if (!d.enabled) { box.innerHTML = '<div class="card narrow"><h4>Скоро будет доступно</h4><p class="muted">Запасные серверы ещё настраиваются. Если сейчас не подключается — напишите в поддержку, поможем.</p></div>'; return; }
  if (!d.linked) { box.innerHTML = '<p class="muted">Запасная ссылка привязана к аккаунту, поэтому сначала привяжите Telegram — это одно нажатие.</p>' + linkCardHtml(); bindLinkCards(box); return; }
  if (!d.access) { box.innerHTML = errorNote(d.message); return; }
  const tryOpen = async (deep, site) => { if (!(await window.sali.openUrl(deep))) { toast('Приложение не установлено — открываем сайт', 'err'); void window.sali.openUrl(site); } };
  box.innerHTML = `<div class="opt-grid">
    <div class="card"><div class="opt-head">${icon('lifebuoy', 'p', 'opt-ico')}<div><small>ВАРИАНТ 1</small><b>Happ</b></div></div><p class="muted">Самый простой запасной вариант. Установите Happ и нажмите «Добавить в Happ» — серверы Sali появятся в нём сами.</p>
      <div class="btns"><button class="btn btn-peach" id="bHapp">Добавить в Happ</button><button class="btn btn-ghost" data-url="${WIN_APPS.happ}">Скачать Happ</button></div></div>
    <div class="card"><div class="opt-head">${icon('apps', 'p', 'opt-ico')}<div><small>ВАРИАНТ 2</small><b>v2RayTun или Hiddify</b></div></div><p class="muted">Если Happ недоступен — те же серверы работают в этих приложениях. Нажмите кнопку, приложение откроется и добавит подписку.</p>
      <div class="btns"><button class="btn btn-peach" id="bV2">Добавить в v2RayTun</button><button class="btn btn-ghost" id="bHid">Добавить в Hiddify</button></div></div>
  </div>
  <div class="card"><div class="opt-head">${icon('link', 'p', 'opt-ico')}<div><small>ДЛЯ ЛЮБОГО ПРИЛОЖЕНИЯ</small><b>Ссылка-подписка</b></div></div><p class="muted">Подходит для любого клиента VLESS: v2rayN, NekoRay, Clash Verge и других. Вставьте её как «подписку по ссылке».</p>
    <button class="copybox" data-copy="${esc(d.url)}"><b class="addr">${esc(d.url)}</b>${icon('copy')}</button></div>
  <p class="fine">${d.servers} ${d.servers === 1 ? 'сервер' : d.servers < 5 ? 'сервера' : 'серверов'}${d.expiresAt ? ` · работает до ${esc(dateRu(d.expiresAt))}` : ''}. Ссылка личная — не пересылайте её. Попала к чужим? <button class="link" id="bReset">Сбросить ссылку</button></p>`;
  box.querySelector('#bHapp').onclick = () => void tryOpen(d.open.happ, WIN_APPS.happ);
  box.querySelector('#bV2').onclick = () => void tryOpen(d.open.v2raytun, WIN_APPS.v2raytun);
  box.querySelector('#bHid').onclick = () => void tryOpen(d.open.hiddify, WIN_APPS.hiddify);
  box.querySelector('[data-copy]').onclick = () => void copy(d.url, 'Ссылка скопирована');
  box.querySelector('#bReset').onclick = async () => {
    if (!(await confirmBox('Сбросить ссылку?', 'Старая ссылка сразу перестанет работать — в Happ и других приложениях её нужно будет добавить заново. Нужно, только если ссылка попала к чужим людям.', 'Сбросить', true))) return;
    try { await api('/app/backup/reset', 'POST'); toast('Новая ссылка готова — добавьте её заново', 'ok'); void renderView(); } catch (e) { toast(e.message, 'err'); }
  };
  bindUrls(box);
};

/* ---------- Устройства ---------- */
const idleText = (days) => (days === null || days === undefined ? 'ещё не подключалось' : days === 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`);
async function loadDevices() {
  el.devHead.textContent = `Одна подписка — до ${home && home.account ? home.account.max : 3} устройств. У аккаунта один Sali ID: ${home && home.user ? home.user.publicId : '—'}`;
  if (!el.devList.children.length) el.devList.innerHTML = loading;
  let d; try { d = await api('/app/devices'); } catch (e) { el.devList.innerHTML = errorNote(e.message); return; }
  el.devList.innerHTML = d.devices.map((x) => `<div class="dev${x.current ? ' current' : ''}">
    <span class="dev-icon"><img src="assets/${x.platform === 'WINDOWS' ? 'windows' : 'android'}-glyph.png" alt="" /></span>
    <span class="dev-copy"><b>${esc(x.name || (x.platform === 'WINDOWS' ? 'Компьютер' : 'Телефон'))}${x.current ? ' · этот компьютер' : ''}</b><small>${esc(x.id)} · ${esc(idleText(x.idleDays))}</small>${x.covered ? '<em class="ok">в подписке</em>' : d.used || home?.subscription ? '<em class="warn">Не входит в подписку — превышен лимит устройств</em>' : ''}</span>
    ${!x.current && d.linked ? `<button class="btn-line" data-remove="${esc(x.key)}" data-label="${esc(x.name || x.id)}">Удалить</button>` : x.current ? '<span class="tag">ЭТО</span>' : ''}
  </div>`).join('');
  el.devLink.innerHTML = d.linked ? '' : linkCardHtml();
  bindLinkCards(el.devLink);
  el.devList.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      if (!(await confirmBox('Удалить устройство?', `${b.dataset.label} перестанет использовать подписку. Его можно будет добавить снова, привязав тот же Telegram.`, 'Удалить', true))) return;
      try { await api('/app/devices/remove', 'POST', { key: b.dataset.remove }); toast('Устройство удалено — место освободилось', 'ok'); void loadDevices(); void loadHome({ quiet: true }); } catch (e) { toast(e.message, 'err'); }
    };
  });
}

/* ---------- Админка (только аккаунт владельца) ---------- */
const stat = (label, value, hint) => `<div class="stat"><small>${esc(label)}</small><b>${esc(value)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</div>`;
async function renderAdminHome() {
  const root = el.admin;
  root.innerHTML = head('Админ-панель') + `<div class="group">
    <button class="row" data-open="admin-user">${icon('search', 'p', 'ri')}<span><b>Найти пользователя</b><small>Sali ID, D-номер, @username или Telegram ID</small></span>${icon('chevron', 'm', 'chev')}</button>
    <button class="row" data-open="admin-people">${icon('users', 'p', 'ri')}<span><b>Пользователи</b><small>Платные, от администрации, бесплатные, ушедшие</small></span>${icon('chevron', 'm', 'chev')}</button>
    <button class="row" data-open="admin-payments">${icon('cash', 'p', 'ri')}<span><b>Платежи</b></span>${icon('chevron', 'm', 'chev')}</button>
    <button class="row" data-open="admin-promos">${icon('tag', 'p', 'ri')}<span><b>Промокоды</b><small>Дни или скидка, лимит и срок</small></span>${icon('chevron', 'm', 'chev')}</button>
  </div><div id="adm">${loading}</div>`;
  bindOpen(root, 'admin');
  const box = root.querySelector('#adm');
  let s; try { s = await api('/app/admin/stats'); } catch (e) { box.innerHTML = errorNote(e.message); return; }
  box.innerHTML = `<p class="label">${icon('key')}ДЕНЬГИ</p><div class="stats four">${stat('Сегодня', money(s.revenue.day), `${s.revenue.dayCount} опл.`)}${stat('7 дней', money(s.revenue.week), `${s.revenue.weekCount} опл.`)}${stat('30 дней', money(s.revenue.month), `${s.revenue.monthCount} опл. · чек ${money(s.revenue.avgCheck30d)}`)}${stat('Всего', money(s.revenue.total), `${s.revenue.payers} платили`)}</div>
    <p class="label">${icon('shield')}ДОСТУП СЕЙЧАС</p><div class="stats four">${stat('Платная подписка', s.access.paid, s.access.expiringPaid3d ? `${s.access.expiringPaid3d} кончаются за 3 дня` : '')}${stat('От администрации', s.access.granted)}${stat('Бесплатные 3 дня', s.access.trial)}${stat('Онлайн', s.access.onlineNow ?? '—')}</div>
    <p class="label">${icon('user')}ЛЮДИ</p><div class="stats four">${stat('Новых за сутки', s.new24h)}${stat('За 7 дней', s.new7d)}${stat('Устройств активно (7 дн.)', s.activeDevices7d)}${stat('Пришли по приглашению', s.referrals.total)}</div>
    <p class="label">${icon('globe')}СЕРВЕРЫ</p><div class="group">${s.servers.map((v) => `<div class="row static">${icon('dot', v.online ? 'g' : 'r', 'ri')}<span><b>${esc(v.name)}</b><small>${v.premiumOnly ? 'платный' : 'бесплатный'}${v.isActive ? '' : ' · выключен'} · ${v.users} ключей</small></span>${v.connectedNow !== null ? `<em>${v.connectedNow} онлайн</em>` : ''}</div>`).join('')}</div>
    <p class="fine">Серверы, рассылки и воронка — по-прежнему в боте: /admin</p>`;
}

const SEGMENTS = [['paid', 'Платные'], ['granted', 'От администрации'], ['trial', 'Бесплатные'], ['expired', 'Ушедшие']];
VIEWS['admin-people'] = async (root, params) => {
  const segment = params.segment || 'paid'; const page = params.page || 0;
  root.innerHTML = head('Пользователи') + `<div class="chips" id="segs"></div><div id="ppl">${loading}</div>`;
  let d; try { d = await api(`/app/admin/people?segment=${segment}&page=${page}`); } catch (e) { root.querySelector('#ppl').innerHTML = errorNote(e.message); return; }
  const segs = root.querySelector('#segs');
  segs.innerHTML = SEGMENTS.map(([k, label]) => `<button class="chip${k === segment ? ' on' : ''}" data-seg="${k}">${label} · ${d.counts[k] ?? 0}</button>`).join('');
  segs.querySelectorAll('[data-seg]').forEach((b) => { b.onclick = () => { stack[stack.length - 1].params = { segment: b.dataset.seg, page: 0 }; void renderView(); }; });
  const box = root.querySelector('#ppl');
  box.innerHTML = (d.list.length ? `<div class="group">${d.list.map((u) => `<button class="row" data-uid="${esc(u.userId)}">${icon(u.blocked ? 'ban' : 'user', u.blocked ? 'r' : 'p', 'ri')}<span><b>${esc(u.name)}${u.username ? ` · @${esc(u.username)}` : ''}</b><small>${esc(u.plan)} · до ${esc(dateRu(u.until, false))}${u.via ? ` · ${esc(u.via)}` : ''}${u.device ? ` · ${esc(u.device)}` : ''}</small></span>${icon('chevron', 'm', 'chev')}</button>`).join('')}</div>` : '<p class="muted">Пусто</p>')
    + (d.pages > 1 ? `<div class="pager"><button class="btn btn-ghost" id="prev" ${page <= 0 ? 'disabled' : ''}>Назад</button><span>${page + 1} / ${d.pages}</span><button class="btn btn-ghost" id="next" ${page + 1 >= d.pages ? 'disabled' : ''}>Дальше</button></div>` : '');
  box.querySelectorAll('[data-uid]').forEach((b) => { b.onclick = () => open('admin-user', { query: b.dataset.uid }); });
  const nav = (p) => { stack[stack.length - 1].params = { segment, page: p }; void renderView(); };
  if (box.querySelector('#prev')) { box.querySelector('#prev').onclick = () => nav(page - 1); box.querySelector('#next').onclick = () => nav(page + 1); }
};

const DAYS = [7, 30, 90, 365, 36500];
const daysLabel = (d) => (d >= 36500 ? 'Навсегда' : d === 365 ? '1 год' : `${d} дн.`);
VIEWS['admin-user'] = async (root, params) => {
  root.innerHTML = head('Пользователь') + `<div class="code-field wide"><input id="q" spellcheck="false" placeholder="SL-XXXX-XXXX, D-XXXXXX, @username, ID" value="${esc(params.query || '')}" /><button class="btn-small" id="find">Найти</button></div><div id="card"></div>`;
  const q = root.querySelector('#q'); const box = root.querySelector('#card');
  const find = async (query) => {
    if (!query.trim()) return;
    box.innerHTML = loading;
    let c; try { c = await api('/app/admin/lookup', 'POST', { query: query.trim() }); } catch (e) { box.innerHTML = errorNote(e.message); return; }
    stack[stack.length - 1].params = { query: c.id };
    let days = 30; let kind = 'gift';
    box.innerHTML = `<div class="user-grid"><div class="card accent">
      <h3>${c.isBlocked ? icon('ban', 'r', 'h-ico') : ''}${esc(c.title)}</h3>
      <p class="line">Sali ID: <button class="link" data-copy="${esc(c.publicId)}">${esc(c.publicId)}</button></p>
      ${c.username ? `<p class="line">Telegram: @${esc(c.username)}</p>` : ''}${c.telegramId ? `<p class="line">Telegram ID: ${esc(c.telegramId)}</p>` : ''}${c.owner ? `<p class="line">Аккаунт: ${esc(c.owner)}</p>` : ''}
      <p class="line">С нами с ${esc(dateRu(c.createdAt))}</p>
      <p class="access${/нет доступа/.test(c.access) ? '' : ' ok'}">${esc(c.access)}</p>
      <p class="line">Баланс: <b>${usd2(c.balanceUsd)}</b>${c.autoRenew ? ' · автопродление включено' : ''}</p>
      <p class="line">Оплатил: ${money(c.paidUsd)} · ${c.payments} раз · пригласил ${c.invited}</p>
      ${c.devices.length ? `<h4>Устройства</h4>${c.devices.map((d) => `<p class="line">${esc(d.publicId)} — ${esc(d.access)}</p>`).join('')}` : ''}
    </div><div>
      <div class="card"><h4>Выдать подписку</h4><div class="chips" id="days">${DAYS.map((d) => `<button class="chip${d === days ? ' on' : ''}" data-days="${d}">${daysLabel(d)}</button>`).join('')}</div>
        <div class="chips" id="kinds"><button class="chip on" data-kind="gift">Подарок</button><button class="chip" data-kind="admin">От администрации</button></div>
        <input class="input" id="msg" placeholder="Сообщение пользователю (необязательно)" maxlength="300" />
        <div class="btns"><button class="btn btn-peach" id="grant">Выдать</button><button class="btn btn-ghost" id="revoke">Забрать подписку</button></div></div>
      <div class="card"><h4>Баланс</h4><div class="two"><input class="input" id="adj" placeholder="+5 или -5" maxlength="8" /><input class="input" id="adjNote" placeholder="Причина (видна в истории)" maxlength="120" /></div>
        <button class="btn btn-ghost" id="adjGo">Изменить баланс</button></div>
      <button class="btn ${c.isBlocked ? 'btn-ghost' : 'btn-danger'}" id="block">${c.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
    </div></div>`;
    box.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => void copy(b.dataset.copy, 'Sali ID скопирован'); });
    box.querySelectorAll('[data-days]').forEach((b) => { b.onclick = () => { days = Number(b.dataset.days); box.querySelectorAll('[data-days]').forEach((o) => o.classList.toggle('on', o === b)); }; });
    box.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { kind = b.dataset.kind; box.querySelectorAll('[data-kind]').forEach((o) => o.classList.toggle('on', o === b)); }; });
    const act = async (fn, done) => { try { await fn(); toast(done, 'ok'); void find(c.id); } catch (e) { toast(e.message, 'err'); } };
    box.querySelector('#grant').onclick = async () => {
      if (!(await confirmBox('Выдать подписку?', `${c.title}: ${daysLabel(days).toLowerCase()} (${kind === 'gift' ? 'подарок' : 'от администрации'})`, 'Выдать'))) return;
      const message = box.querySelector('#msg').value.trim();
      void act(() => api('/app/admin/grant', 'POST', { userId: c.id, days, kind, ...(message ? { message } : {}) }), 'Подписка выдана');
    };
    box.querySelector('#revoke').onclick = async () => { if (await confirmBox('Забрать подписку?', 'Все активные подписки аккаунта закончатся сейчас, VPN отключится.', 'Забрать', true)) void act(() => api('/app/admin/revoke', 'POST', { userId: c.id }), 'Подписка снята'); };
    box.querySelector('#block').onclick = async () => { if (await confirmBox(c.isBlocked ? 'Разблокировать?' : 'Заблокировать?', c.title, c.isBlocked ? 'Разблокировать' : 'Заблокировать', !c.isBlocked)) void act(() => api('/app/admin/block', 'POST', { userId: c.id, isBlocked: !c.isBlocked }), c.isBlocked ? 'Разблокирован' : 'Заблокирован'); };
    box.querySelector('#adjGo').onclick = async () => {
      const v = Number(box.querySelector('#adj').value.replace(',', '.'));
      if (!v) { toast('Введите сумму, например +5 или -5', 'err'); return; }
      if (await confirmBox('Изменить баланс?', `${c.title}: ${v > 0 ? '+' : ''}${v} $`, 'Изменить')) void act(() => api('/app/admin/balance', 'POST', { userId: c.id, amountUsd: v, note: box.querySelector('#adjNote').value.trim() || 'Администратор' }), 'Баланс изменён');
    };
  };
  root.querySelector('#find').onclick = () => void find(q.value);
  q.onkeydown = (e) => { if (e.key === 'Enter') void find(q.value); };
  if (params.query) void find(params.query);
};

VIEWS['admin-payments'] = async (root) => {
  root.innerHTML = head('Платежи') + `<div id="pay">${loading}</div>`;
  const box = root.querySelector('#pay');
  let rows; try { rows = await api('/app/admin/payments'); } catch (e) { box.innerHTML = errorNote(e.message); return; }
  box.innerHTML = rows.length ? `<div class="group">${rows.map((p) => `<button class="row" data-q="${esc(p.account)}">${icon(p.status === 'SUCCEEDED' ? 'check' : 'dot', p.status === 'SUCCEEDED' ? 'g' : 'm', 'ri')}<span><b>${money(p.amountUsd)} · ${esc(p.plan)}${p.discountPercent ? ` · −${p.discountPercent}%` : ''}</b><small>${esc(dateTime(p.at))} · ${esc(p.name || p.account)} · ${esc(p.method)}${p.giftTo ? ` · подарок ${esc(p.giftTo)}` : ''}</small></span><em>${esc(p.status === 'SUCCEEDED' ? 'оплачен' : p.status === 'PENDING' ? 'ждёт' : p.status.toLowerCase())}</em></button>`).join('')}</div>` : '<p class="muted">Платежей пока нет</p>';
  box.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => open('admin-user', { query: b.dataset.q }); });
};

VIEWS['admin-promos'] = async (root) => {
  root.innerHTML = head('Промокоды') + `<div class="card narrow"><h4>Новый промокод</h4>
    <input class="input" id="pCode" placeholder="Код, например SALI2026" maxlength="32" />
    <div class="chips"><button class="chip on" data-pk="DAYS">Дни подписки</button><button class="chip" data-pk="DISCOUNT">Скидка %</button></div>
    <div class="two three"><input class="input" id="pVal" value="7" placeholder="Сколько дней" maxlength="5" /><input class="input" id="pMax" placeholder="Лимит (пусто = ∞)" maxlength="6" /><input class="input" id="pExp" placeholder="Дней действует (∞)" maxlength="5" /></div>
    <button class="btn btn-peach" id="pCreate">Создать</button></div><p class="label">ВСЕ ПРОМОКОДЫ</p><div id="plist">${loading}</div>`;
  let kind = 'DAYS';
  const code = root.querySelector('#pCode'); const val = root.querySelector('#pVal');
  code.oninput = () => { code.value = code.value.toUpperCase().replace(/\s/g, ''); };
  root.querySelectorAll('[data-pk]').forEach((b) => { b.onclick = () => { kind = b.dataset.pk; val.value = kind === 'DAYS' ? '7' : '20'; val.placeholder = kind === 'DAYS' ? 'Сколько дней' : 'Скидка, %'; root.querySelectorAll('[data-pk]').forEach((o) => o.classList.toggle('on', o === b)); }; });
  const num = (v) => (v.trim() ? Number(v.replace(/[^0-9]/g, '')) : undefined);
  const list = root.querySelector('#plist');
  const load = async () => {
    let rows; try { rows = await api('/app/admin/promos'); } catch (e) { list.innerHTML = errorNote(e.message); return; }
    list.innerHTML = rows.length ? `<div class="group">${rows.map((p) => `<div class="row static${p.isActive ? '' : ' off'}">${icon('tag', 'p', 'ri')}<span><b><button class="link" data-copy="${esc(p.code)}">${esc(p.code)}</button></b><small>${p.kind === 'DAYS' ? `+${p.days} дн.` : `−${p.discountPercent}%`} · использован ${p.usedCount}${p.maxUses ? ` из ${p.maxUses}` : ''}${p.expiresAt ? ` · до ${esc(dateRu(p.expiresAt, false))}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</small></span><button class="switch${p.isActive ? ' on' : ''}" data-pid="${esc(p.id)}" data-active="${p.isActive ? 1 : 0}"><i></i></button></div>`).join('')}</div>` : '<p class="muted">Пока ни одного</p>';
    list.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => void copy(b.dataset.copy, 'Промокод скопирован'); });
    list.querySelectorAll('[data-pid]').forEach((b) => { b.onclick = async () => { try { await api(`/app/admin/promos/${b.dataset.pid}/active`, 'POST', { isActive: b.dataset.active !== '1' }); void load(); } catch (e) { toast(e.message, 'err'); } }; });
  };
  root.querySelector('#pCreate').onclick = async () => {
    const n = num(val.value) || 0;
    if (code.value.length < 3 || !n) { toast('Нужны код (от 3 символов) и значение', 'err'); return; }
    try {
      const made = await api('/app/admin/promos', 'POST', { code: code.value, kind, ...(kind === 'DAYS' ? { days: n } : { discountPercent: n }), maxUses: num(root.querySelector('#pMax').value), expiresInDays: num(root.querySelector('#pExp').value) });
      toast(`Промокод ${made.code} создан`, 'ok'); code.value = ''; void load();
    } catch (e) { toast(e.message, 'err'); }
  };
  void load();
};

/* ---------- wiring ---------- */
function bindOpen(root, parent) { root.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => (b.dataset.open === 'admin-home' ? go('admin') : open(b.dataset.open, {}, parent || b.closest('.page')?.dataset.page)); }); }
function bindUrls(root) { root.querySelectorAll('[data-url]').forEach((b) => { b.onclick = () => void window.sali.openUrl(b.dataset.url); }); }
bindOpen(document);
bindUrls(document);
document.querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => go(b.dataset.goto); });
document.querySelectorAll('[data-help]').forEach((node) => node.addEventListener('click', () => void window.sali.openHelp(node.dataset.help || undefined)));
document.querySelectorAll('[data-site]').forEach((node) => node.addEventListener('click', () => void window.sali.openSite(node.dataset.site)));
el.plansCard.addEventListener('click', () => open('plans', {}, 'sub'));
el.getCode.addEventListener('click', () => open('plans', {}, 'sub'));
el.tariffStub.addEventListener('click', () => go('sub'));
el.subDevices.addEventListener('click', () => go('devices'));
el.rowTelegram.addEventListener('click', () => (linkedNow() ? void window.sali.openBot() : linkToBot()));
el.rowId.addEventListener('click', () => { if (home) void copy(home.user.publicId, 'Sali ID скопирован'); });
el.idChip.addEventListener('click', () => { if (home) void copy(home.user.publicId, 'Sali ID скопирован'); });
el.support.addEventListener('click', () => void window.sali.openSupport());
el.phone.addEventListener('click', () => void window.sali.openDownload());

const FAQ = [
  ['Как начать?', 'Нажмите на знак на вкладке VPN — первые 3 дня бесплатно, без регистрации и Telegram.'],
  ['Как купить подписку?', 'Вкладка «Подписка» → «Выбрать тариф». Для оплаты один раз привяжите Telegram (одно нажатие). Оплата — USDT в сети TON или с баланса Sali.'],
  ['Подписка куплена на телефоне — почему её нет на компьютере?', 'Подписка на аккаунте и работает на всех устройствах сама. Привяжите на компьютере тот же Telegram: «Настройки» → «Telegram». Через пару секунд подписка появится.'],
  ['Можно на нескольких устройствах?', 'Да, до 3 одновременно. Подписку получают устройства, которыми вы пользуетесь; старые, давно не открывавшиеся, уступают место сами. Удалить лишнее можно во вкладке «Устройства».'],
  ['VPN не подключается', 'Выключите другие VPN и прокси и попробуйте снова. Windows может спросить разрешение для службы WireGuard — его нужно подтвердить. Не помогло — «Настройки» → «Запасное подключение» или напишите в поддержку.'],
  ['VPN работает, когда окно закрыто?', 'Да. Закрытие окна сворачивает Sali в область уведомлений, VPN остаётся включённым. Отключить его можно там же, правой кнопкой по значку.'],
];
FAQ.forEach(([question, answer], index) => {
  const item = document.createElement('div');
  item.className = 'qa';
  item.innerHTML = `<button aria-expanded="false" aria-controls="qa${index}"><span>${esc(question)}</span><i class="plus" aria-hidden="true"></i></button><div class="answer" id="qa${index}"><p>${esc(answer)}</p></div>`;
  item.querySelector('button').addEventListener('click', () => {
    const isOpen = !item.classList.contains('open');
    el.faq.querySelectorAll('.qa.open').forEach((other) => { other.classList.remove('open'); other.querySelector('button').setAttribute('aria-expanded', 'false'); });
    item.classList.toggle('open', isOpen);
    item.querySelector('button').setAttribute('aria-expanded', String(isOpen));
  });
  el.faq.appendChild(item);
});

/* keyboard: 1–6 switch sections, Space toggles VPN, Esc closes a window or goes back */
document.addEventListener('keydown', (event) => {
  if (!el.modal.hidden) { if (event.key === 'Escape') closeModal(); return; }
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'Escape' && current === 'view') { back(); return; }
  const index = ['1', '2', '3', '4', '5', '6'].indexOf(event.key);
  if (index >= 0 && !event.ctrlKey && !event.altKey) { const tab = tabs[index]; if (tab && !tab.hidden) go(tab.dataset.page); return; }
  if (event.code === 'Space' && current === 'vpn' && document.activeElement === document.body) { event.preventDefault(); void togglePower(); }
});

/* boot */
(async () => {
  el.version.textContent = 'Sali VPN ' + await window.sali.version();
  const state = await window.sali.vpnState();
  vpn = { ...vpn, ...state };
  render();
  await loadHome();
  void loadPlans();
  setInterval(render, 1000);
  setInterval(() => void loadHome({ quiet: true }), 60000);
  window.addEventListener('focus', () => void loadHome({ quiet: true }));
})();
