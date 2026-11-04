/* Sali VPN for Windows — UI logic. Talks to the main process only through window.sali. */
const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), publicId: $('publicId'), idChip: $('idChip'), statusTitle: $('statusTitle'), statusSub: $('statusSub'),
  power: $('power'), powerLabel: $('powerLabel'), powerSub: $('powerSub'), timer: $('timer'),
  access: $('access'), accessText: $('accessText'), server: $('server'), flag: $('flag'),
  enterCode: $('enterCode'), getCode: $('getCode'), getCodeLabel: $('getCodeLabel'), linkCard: $('linkCard'), linkBtn: $('linkBtn'),
  sheet: $('sheet'), form: $('codeForm'), input: $('codeInput'), paste: $('paste'), error: $('codeError'), submit: $('codeSubmit'), cancel: $('codeCancel'),
  toast: $('toast'), support: $('support'), phone: $('phone'), version: $('version'),
};

let home = null;
let vpn = { state: 'disconnected', serverLocation: null, connectedAt: null };
let homeLoadedAt = 0;

const FLAGS = [[/nether|нидерл|amster|амстер/i, 'flag-nl'], [/german|герман|frank|франкф|berlin|берлин/i, 'flag-de'], [/usa|united states|сша|new york|нью-йорк/i, 'flag-us']];
const flagFor = (location) => (FLAGS.find(([re]) => re.test(location || '')) || [null, 'globe-glyph'])[1];

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
  el.app.classList.toggle('is-busy', busy);
  el.power.disabled = busy;

  el.statusTitle.textContent = on ? 'Соединение защищено' : busy ? (vpn.state === 'connecting' ? 'Подключаемся…' : 'Отключаемся…') : 'VPN выключен';
  el.statusSub.textContent = vpn.detail || (on ? 'Весь трафик компьютера идёт через Sali' : a.kind === 'none' ? 'Активируйте код, чтобы подключиться' : 'Нажмите кнопку, чтобы подключиться');
  el.powerLabel.textContent = on ? 'В сети' : busy ? '…' : 'Подключить';
  el.powerSub.textContent = on ? 'ЗАЩИЩЕНО' : busy ? 'ПОДОЖДИТЕ' : 'НАЖМИТЕ';
  el.power.setAttribute('aria-label', on ? 'Отключить VPN' : 'Подключить VPN');
  el.timer.textContent = on && vpn.connectedAt ? `В сети ${hms((Date.now() - vpn.connectedAt) / 1000)}` : ' ';

  el.access.className = 'pill ' + (a.kind === 'paid' ? 'ok' : a.kind === 'trial' ? 'trial' : a.kind === 'none' ? 'none' : '');
  if (a.kind === 'paid') el.accessText.innerHTML = `${escapeHtml(a.plan || 'Подписка')} до <b>${a.until ? new Date(a.until).toLocaleDateString('ru-RU') : '—'}</b>`;
  else if (a.kind === 'trial') el.accessText.innerHTML = `Бесплатный день: осталось <b>${hms(a.left)}</b>`;
  else if (a.kind === 'none') el.accessText.textContent = a.hadTrial ? 'Доступ закончился — продлите в боте' : 'Нет активного тарифа';
  else el.accessText.textContent = 'Проверяем доступ…';

  el.getCodeLabel.textContent = a.kind === 'none' && !a.hadTrial ? 'Бесплатный день' : a.kind === 'none' ? 'Купить в боте' : 'Мои коды в боте';
  el.server.textContent = vpn.serverLocation || 'Автовыбор';
  el.flag.src = `assets/${flagFor(vpn.serverLocation)}.png`;
  el.linkCard.hidden = !home || Boolean(home.user && home.user.telegramLinked);
  if (home && home.user) el.publicId.textContent = home.user.publicId;
}

function escapeHtml(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

async function loadHome({ quiet = false } = {}) {
  const response = await window.sali.home();
  if (response.ok) { home = response.home; homeLoadedAt = Date.now(); }
  else if (!quiet) { el.statusSub.textContent = response.error; toast(response.error, 'err'); }
  render();
}

el.power.addEventListener('click', async () => {
  if (vpn.state === 'connected') { await window.sali.disconnect(); return; }
  if (access().kind === 'none') { openSheet(); return; }
  const result = await window.sali.connect();
  if (!result.ok) {
    toast(result.error, 'err');
    if (result.status === 403) openSheet();
  }
  void loadHome({ quiet: true });
});

window.sali.onVpnState((payload) => {
  vpn = { ...vpn, state: payload.state, detail: payload.detail, serverLocation: payload.serverLocation ?? vpn.serverLocation };
  if (payload.state === 'connected' && !vpn.connectedAt) vpn.connectedAt = Date.now();
  if (payload.state === 'disconnected') vpn.connectedAt = null;
  render();
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
el.cancel.addEventListener('click', closeSheet);
el.sheet.addEventListener('click', (event) => { if (event.target === el.sheet) closeSheet(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !el.sheet.hidden) closeSheet(); });
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
  toast(r.kind === 'FREE' ? 'Бесплатный день включён — 24 часа VPN. Можно подключаться!' : `Подписка активирована${r.expiresAt ? ` до ${new Date(r.expiresAt).toLocaleDateString('ru-RU')}` : ''}.`, 'ok');
  await loadHome({ quiet: true });
});

/* bot, links */
el.getCode.addEventListener('click', () => { const a = access(); void window.sali.openBot(a.kind === 'none' && !a.hadTrial ? 'free' : a.kind === 'none' ? 'buy' : undefined); });
el.linkBtn.addEventListener('click', () => {
  const id = (home && home.user && home.user.publicId || '').replace(/[^0-9A-Z]/gi, '').replace(/^SL/i, '');
  void window.sali.openBot(id ? `link_${id}` : undefined);
});
el.idChip.addEventListener('click', async () => { if (!home) return; await window.sali.copy(home.user.publicId); toast('Sali ID скопирован', 'ok'); });
el.support.addEventListener('click', () => void window.sali.openSupport());
el.phone.addEventListener('click', () => void window.sali.openDownload());

/* boot */
(async () => {
  el.version.textContent = 'v' + await window.sali.version();
  const state = await window.sali.vpnState();
  vpn = { ...vpn, ...state };
  render();
  await loadHome();
  setInterval(render, 1000);
  setInterval(() => void loadHome({ quiet: true }), 60000);
  window.addEventListener('focus', () => void loadHome({ quiet: true }));
})();
