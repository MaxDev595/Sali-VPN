/* Sali VPN for Windows — UI logic. Talks to the main process only through window.sali. */
const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), publicId: $('publicId'), idChip: $('idChip'), statusTitle: $('statusTitle'), statusSub: $('statusSub'),
  power: $('power'), timer: $('timer'), tariffStub: $('tariffStub'), accessMain: $('accessMain'), accessSub: $('accessSub'),
  server: $('server'), flag: $('flag'),
  enterCode: $('enterCode'), getCode: $('getCode'), getCodeLabel: $('getCodeLabel'), linkCard: $('linkCard'), linkBtn: $('linkBtn'),
  sheet: $('sheet'), form: $('codeForm'), input: $('codeInput'), paste: $('paste'), error: $('codeError'), submit: $('codeSubmit'), cancel: $('codeCancel'),
  toast: $('toast'), support: $('support'), phone: $('phone'), version: $('version'),
  nav: $('nav'), navDrop: $('navDrop'), devId: $('devId'), devTariff: $('devTariff'), devTg: $('devTg'),
  rowTelegram: $('rowTelegram'), tgValue: $('tgValue'), tgHint: $('tgHint'), supportId: $('supportId'), faq: $('faq'),
};

let home = null;
let vpn = { state: 'disconnected', serverLocation: null, connectedAt: null };
let homeLoadedAt = 0;

const FLAGS = [[/nether|нидерл|amster|амстер/i, 'flag-nl'], [/german|герман|frank|франкф|berlin|берлин/i, 'flag-de'], [/usa|united states|сша|new york|нью-йорк/i, 'flag-us']];
const flagFor = (location) => (FLAGS.find(([re]) => re.test(location || '')) || [null, 'globe-glyph'])[1];

const FAQ = [
  ['VPN не подключается', 'Проверьте, что тариф активен (карточка «Тариф»), выключите другие VPN и прокси, затем попробуйте снова. Windows может спросить разрешение для службы WireGuard — его нужно подтвердить.'],
  ['Подключился, но сайты не открываются', 'Отключитесь и подключитесь снова — Sali перенесёт вас на рабочий сервер. Если используете свой DNS или прокси в браузере, выключите их.'],
  ['Куда вводить код?', 'Кнопка «Ввести код» на странице VPN. Регистр и дефисы не важны — код можно просто вставить кнопкой «Вставить».'],
  ['Как получить 24 часа бесплатно?', 'Нажмите «24 часа бесплатно» — откроется наш Telegram-бот. Он пришлёт код, который нужно ввести здесь.'],
  ['Можно на нескольких устройствах?', 'Да. Один код активирует одно устройство: купите код для каждого и активируйте его кнопкой в боте — он спросит, на какое устройство.'],
  ['VPN работает, когда окно закрыто?', 'Да. Закрытие окна сворачивает Sali в область уведомлений, VPN остаётся включённым. Отключить его можно там же, правой кнопкой по значку.'],
];

function toast(text, kind = '') {
  el.toast.textContent = text;
  el.toast.className = `toast ${kind}`;
  el.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.toast.hidden = true; }, 4200);
}

function hms(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
}

function access() {
  if (!home) return { kind: 'loading' };
  if (home.subscription && home.subscription.status === 'ACTIVE') return { kind: 'paid', until: home.subscription.expiresAt, plan: home.subscription.plan?.name };
  if (home.trial && home.trial.status === 'ACTIVE') {
    const left = home.trial.secondsRemaining - (Date.now() - homeLoadedAt) / 1000;
    if (left > 0) return { kind: 'trial', left };
  }
  return { kind: 'none', hadTrial: Boolean(home.trial) };
}

function render() {
  const a = access();
  const busy = vpn.state === 'connecting' || vpn.state === 'disconnecting';
  const on = vpn.state === 'connected';
  el.app.classList.toggle('is-connected', on);
  el.app.classList.toggle('is-connecting', vpn.state === 'connecting');
  el.app.classList.toggle('is-disconnecting', vpn.state === 'disconnecting');
  el.power.disabled = busy;

  el.statusTitle.textContent = on ? 'Соединение защищено' : vpn.state === 'connecting' ? 'Рисуем туннель…' : vpn.state === 'disconnecting' ? 'Отключаемся…' : 'VPN выключен';
  el.statusSub.textContent = vpn.detail || (on ? 'Весь трафик компьютера идёт через Sali' : busy ? ' ' : a.kind === 'none' ? 'Активируйте код, чтобы подключиться' : 'Нажмите на знак, чтобы подключиться');
  el.power.setAttribute('aria-label', on ? 'Отключить VPN' : 'Подключить VPN');
  el.timer.textContent = on && vpn.connectedAt ? hms((Date.now() - vpn.connectedAt) / 1000) : ' ';

  el.tariffStub.className = 'stub' + (a.kind === 'none' ? ' none' : '');
  if (a.kind === 'paid') { el.accessMain.textContent = a.until ? `до ${new Date(a.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : 'Подписка'; el.accessSub.textContent = a.plan || 'Подписка'; }
  else if (a.kind === 'trial') { el.accessMain.innerHTML = `<span class="mono">${hms(a.left)}</span>`; el.accessSub.textContent = 'Бесплатно'; }
  else if (a.kind === 'none') { el.accessMain.textContent = 'Ввести код'; el.accessSub.textContent = a.hadTrial ? 'Тариф закончился' : 'Нет тарифа'; }
  else { el.accessMain.textContent = '—'; el.accessSub.textContent = 'Проверяем доступ…'; }

  el.getCodeLabel.textContent = a.kind === 'none' && !a.hadTrial ? '24 часа бесплатно' : a.kind === 'none' ? 'Купить в боте' : 'Мои коды в боте';
  el.server.textContent = vpn.serverLocation || 'Автовыбор';
  el.flag.src = `assets/${flagFor(vpn.serverLocation)}.png`;

  const linked = Boolean(home && home.user && home.user.telegramLinked);
  el.linkCard.hidden = !home || linked;
  const id = home && home.user ? home.user.publicId : '—';
  el.publicId.textContent = home && home.user ? id : '····-····';
  el.devId.textContent = id; el.supportId.textContent = id;
  el.devTariff.textContent = a.kind === 'paid' ? 'подписка' : a.kind === 'trial' ? 'бесплатный' : a.kind === 'none' ? 'нет' : '—';
  el.devTg.textContent = home ? (linked ? 'привязан' : 'не привязан') : '—';
  el.tgValue.textContent = home ? (linked ? 'Привязан' : 'Привязать') : '—';
  el.tgHint.textContent = linked ? 'Коды и напоминания приходят в бот' : 'Привяжите, чтобы активировать коды одной кнопкой';
}

function escapeHtml(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

async function loadHome({ quiet = false } = {}) {
  const response = await window.sali.home();
  if (response.ok) { home = response.home; homeLoadedAt = Date.now(); }
  else if (!quiet) { el.statusSub.textContent = response.error; toast(response.error, 'err'); }
  render();
}

async function togglePower() {
  if (el.power.disabled) return;
  if (vpn.state === 'connected') { await window.sali.disconnect(); return; }
  if (access().kind === 'none') { openSheet(); return; }
  const result = await window.sali.connect();
  if (!result.ok) {
    toast(result.error, 'err');
    if (result.status === 403) openSheet();
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

/* navigation with page transitions; the pen cap slides to the current section */
const pages = [...document.querySelectorAll('.page')];
const tabs = [...el.nav.querySelectorAll('button[data-page]')];
let current = 'vpn';
function go(name) {
  if (name === current) return;
  const from = pages.find((page) => page.dataset.page === current);
  const to = pages.find((page) => page.dataset.page === name);
  const tab = tabs.find((button) => button.dataset.page === name);
  if (!to || !tab) return;
  current = name;
  pour(tabs.find((button) => button.getAttribute('aria-selected') === 'true'), tab);
  from.classList.remove('enter'); from.classList.add('leave');
  setTimeout(() => {
    from.hidden = true; from.classList.remove('leave');
    to.hidden = false; to.scrollTop = 0;
    to.classList.remove('enter'); void to.offsetWidth; to.classList.add('enter');
  }, 160);
}
tabs.forEach((button) => button.addEventListener('click', () => go(button.dataset.page)));

/* The peach colour leaves the old icon as a drop, slides along the menu
   (stretching like liquid while it moves) and pours into the new icon. */
function pour(fromTab, toTab) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = (button) => button.offsetTop + button.offsetHeight / 2;
  const select = () => { tabs.forEach((button) => button.setAttribute('aria-selected', String(button === toTab))); toTab.classList.remove('pour'); void toTab.offsetWidth; toTab.classList.add('pour'); };
  if (!fromTab || fromTab === toTab || reduce || !el.navDrop.animate) { select(); return; }
  fromTab.setAttribute('aria-selected', 'false');
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

/* help centre and site links */
document.querySelectorAll('[data-help]').forEach((node) => node.addEventListener('click', () => void window.sali.openHelp(node.dataset.help || undefined)));
document.querySelectorAll('[data-site]').forEach((node) => node.addEventListener('click', () => void window.sali.openSite(node.dataset.site)));

/* FAQ: answers open to their height, the plus turns into a cross */
FAQ.forEach(([question, answer], index) => {
  const item = document.createElement('div');
  item.className = 'qa';
  item.innerHTML = `<button aria-expanded="false" aria-controls="qa${index}"><span>${escapeHtml(question)}</span><i class="plus" aria-hidden="true"></i></button><div class="answer" id="qa${index}"><p>${escapeHtml(answer)}</p></div>`;
  item.querySelector('button').addEventListener('click', () => {
    const open = !item.classList.contains('open');
    el.faq.querySelectorAll('.qa.open').forEach((other) => { other.classList.remove('open'); other.querySelector('button').setAttribute('aria-expanded', 'false'); });
    item.classList.toggle('open', open);
    item.querySelector('button').setAttribute('aria-expanded', String(open));
  });
  el.faq.appendChild(item);
});

/* activation code sheet */
function formatCode(raw) {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('SALI')) s = s.slice(4);
  s = s.slice(0, 12);
  const groups = s.match(/.{1,4}/g) || [];
  return groups.length ? `SALI-${groups.join('-')}` : '';
}
function openSheet() { el.sheet.hidden = false; el.error.hidden = true; setTimeout(() => el.input.focus(), 60); }
function closeSheet() { el.sheet.hidden = true; el.input.value = ''; }
el.enterCode.addEventListener('click', openSheet);
el.tariffStub.addEventListener('click', openSheet);
el.cancel.addEventListener('click', closeSheet);
el.sheet.addEventListener('click', (event) => { if (event.target === el.sheet) closeSheet(); });
el.input.addEventListener('input', () => { el.input.value = formatCode(el.input.value); el.error.hidden = true; });
el.paste.addEventListener('click', async () => { el.input.value = formatCode(await window.sali.readClipboard()); el.input.focus(); });
el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = el.input.value.replace(/[^0-9A-Z]/gi, '');
  if (code.length < 16) { el.error.textContent = 'Введите код полностью: SALI-XXXX-XXXX-XXXX'; el.error.hidden = false; return; }
  el.submit.disabled = true; el.submit.textContent = 'Проверяем…';
  const response = await window.sali.redeem(code);
  el.submit.disabled = false; el.submit.textContent = 'Активировать';
  if (!response.ok) { el.error.textContent = response.error; el.error.hidden = false; return; }
  closeSheet();
  const r = response.result;
  toast(r.kind === 'FREE' ? 'Бесплатные 24 часа включены. Можно подключаться!' : `Подписка активирована${r.expiresAt ? ` до ${new Date(r.expiresAt).toLocaleDateString('ru-RU')}` : ''}.`, 'ok');
  await loadHome({ quiet: true });
});

/* keyboard: 1–4 switch sections, Space toggles VPN, Ctrl+V on the VPN page opens the code sheet */
document.addEventListener('keydown', (event) => {
  if (!el.sheet.hidden) { if (event.key === 'Escape') closeSheet(); return; }
  if (event.target instanceof HTMLInputElement) return;
  const index = ['1', '2', '3', '4'].indexOf(event.key);
  if (index >= 0 && !event.ctrlKey && !event.altKey) { go(tabs[index].dataset.page); return; }
  if (event.code === 'Space' && current === 'vpn' && document.activeElement === document.body) { event.preventDefault(); void togglePower(); }
  if (event.key.toLowerCase() === 'v' && event.ctrlKey && current === 'vpn') { openSheet(); void window.sali.readClipboard().then((text) => { el.input.value = formatCode(text); }); }
});

/* bot, links */
const linkToBot = () => {
  const id = (home && home.user && home.user.publicId || '').replace(/[^0-9A-Z]/gi, '').replace(/^SL/i, '');
  void window.sali.openBot(id ? `link_${id}` : undefined);
};
el.getCode.addEventListener('click', () => { const a = access(); void window.sali.openBot(a.kind === 'none' && !a.hadTrial ? 'free' : a.kind === 'none' ? 'buy' : undefined); });
el.linkBtn.addEventListener('click', linkToBot);
el.rowTelegram.addEventListener('click', () => { if (home && home.user && !home.user.telegramLinked) linkToBot(); else void window.sali.openBot(); });
el.idChip.addEventListener('click', async () => { if (!home) return; await window.sali.copy(home.user.publicId); toast('Sali ID скопирован', 'ok'); });
el.support.addEventListener('click', () => void window.sali.openSupport());
el.phone.addEventListener('click', () => void window.sali.openDownload());

/* boot */
(async () => {
  el.version.textContent = 'Sali VPN ' + await window.sali.version();
  const state = await window.sali.vpnState();
  vpn = { ...vpn, ...state };
  render();
  await loadHome();
  setInterval(render, 1000);
  setInterval(() => void loadHome({ quiet: true }), 60000);
  window.addEventListener('focus', () => void loadHome({ quiet: true }));
})();
