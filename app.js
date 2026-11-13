(function () {
'use strict';
var R = window.RP, $ = document.getElementById('app');
function ld(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function sv(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
var AUTO = (function () { var p = location.pathname.split('/')[1]; return /\.github\.io$/.test(location.hostname) && p ? location.hostname.split('.')[0] + '/' + p : ''; })();
var DR = AUTO ? AUTO.split('/')[0] + '/poker_data' : '';
var C = ld('rp_cfg') || {}; if (C.repo === AUTO) C = {}; C.repo = C.repo || DR; sv('rp_cfg', C);
var P = ld('rp_pend') || { g: {}, del: [] }, L0 = ld('rp_v1') || {};
var S = { games: [], set: ld('rp_set') || L0.set || { names: ['Гравець 1', 'Гравець 2', 'Гравець 3'] }, view: 'menu', gid: null, draft: null,
  unl: null, edit: null, sh: false, st: C.tok && C.repo ? 'load' : 'off', cd: { tok: '', repo: C.repo || '' }, msg: '', pg: 0 };
var tm = null, busy = false, sha = null, prev = '';
var esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
var G = () => S.games.find(g => g.id === S.gid);
var fdate = t => new Date(t).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
var stTxt = () => S.st === 'err' && S.err ? 'Помилка ' + S.err : ({ off: 'Лише на пристрої', load: 'Завантаження…', sync: 'Зберігаю…', ok: 'Збережено', err: 'Помилка', ro: 'Лише перегляд', notok: 'Потрібен токен' })[S.st];
function ui() { var e = document.getElementById('st'); if (e) e.textContent = stTxt(); }
var br = () => '';
var canW = () => !!(C.tok && C.repo);

/* ---------- сховище GitHub ---------- */
var b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
function b64e(s) { var u = new TextEncoder().encode(s), o = '', i; for (i = 0; i < u.length; i += 8192) o += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(o); }
function api(m, body) {
  var b = br(), h = { Accept: 'application/vnd.github+json' };
  if (C.tok) h.Authorization = 'Bearer ' + C.tok;
  if (body && b) body.branch = b;
  return fetch('https://api.github.com/repos/' + C.repo + '/contents/games.json' + (m === 'GET' ? '?t=' + Date.now() + (b ? '&ref=' + b : '') : ''),
    { method: m, cache: 'no-store', headers: h, body: body ? JSON.stringify(body) : undefined });
}
async function pull() {
  var r = await api('GET');
  if (r.status === 404) { sha = null; return []; }
  if (!r.ok) throw new Error(r.status);
  var j = await r.json(); sha = j.sha; return JSON.parse(b64d(j.content)).games || [];
}
function applyPend(list) {
  list = list.filter(g => P.del.indexOf(g.id) < 0);
  Object.keys(P.g).forEach(function (id) {
    var d = P.g[id], i = list.findIndex(g => g.id === id);
    if (i < 0) list.push(d); else if ((d.updated || 0) >= (list[i].updated || 0)) list[i] = d;
  });
  return list;
}
var pend = () => Object.keys(P.g).length || P.del.length;
async function flush() {
  if (!canW() || busy || !pend()) return;
  busy = true; S.st = 'sync'; ui();
  var snap = {}, sd = P.del.slice(), ok = false; S.err = '';
  Object.keys(P.g).forEach(id => { snap[id] = P.g[id].updated; });
  try {
    for (var t = 0; t < 3 && !ok; t++) {
      var list = applyPend(await pull());
      var r = await api('PUT', { message: 'sync', content: b64e(JSON.stringify({ games: list })), sha: sha || undefined });
      if (r.ok) {
        sha = (await r.json()).content.sha;
        Object.keys(snap).forEach(id => { if (P.g[id] && P.g[id].updated === snap[id]) delete P.g[id]; });
        P.del = P.del.filter(id => sd.indexOf(id) < 0); sv('rp_pend', P);
        list.forEach(R.refresh); S.games = list; ok = true;
      } else { S.err = String(r.status); if (r.status !== 409 && r.status !== 422) throw new Error(r.status); }
    }
  } catch (e) { if (!S.err) S.err = String(e.message || e); }
  S.st = ok ? 'ok' : 'err'; busy = false; ui();
  if (ok && pend()) flush();
}
function queue(ms) {
  sv('rp_pend', P);
  if (!canW()) { S.st = 'notok'; ui(); return; }
  S.st = 'sync'; ui(); clearTimeout(tm); tm = setTimeout(flush, ms);
}
function dirty(g) {
  g.updated = Date.now();
  if (!canW()) { sv('rp_v1', { games: S.games }); return; }
  P.g[g.id] = g; queue(600);
}
function drop(id) {
  if (!confirm('Видалити цю гру? Дію не можна скасувати.')) return false;
  S.games = S.games.filter(x => x.id !== id);
  if (canW()) { delete P.g[id]; P.del.push(id); queue(300); } else sv('rp_v1', { games: S.games });
  return true;
}
async function refresh() {
  if (!canW()) return;
  S.st = 'load'; ui();
  try { S.games = applyPend(await pull()); S.games.forEach(R.refresh); S.st = pend() && !canW() ? 'notok' : (canW() ? 'ok' : 'ro'); } catch (e) { S.st = 'err'; }
  render();
}
async function conn() {
  var tok = S.cd.tok.replace(/\s/g, '') || C.tok, repo = S.cd.repo.replace(/\s/g, '') || DR;
  if (!tok || !/^[^\/\s]+\/[^\/\s]+$/.test(repo)) { S.msg = 'Вкажіть токен і репозиторій (логін/назва)'; render(); return; }
  S.msg = 'Перевіряю…'; render();
  try {
    var rr = await fetch('https://api.github.com/repos/' + repo, { headers: { Authorization: 'Bearer ' + tok } });
    if (!rr.ok) throw new Error(String(rr.status));
    var pm = (await rr.json()).permissions;
    if (!pm || !pm.push) { S.msg = 'Токен без права запису (потрібно Contents: Read and write)'; render(); return; }
    C = { tok: tok, repo: repo }; sv('rp_cfg', C); S.cd.tok = ''; sha = null; S.msg = 'Підключено';
    S.games.forEach(g => { P.g[g.id] = g; }); sv('rp_pend', P); localStorage.removeItem('rp_v1');
    try { S.games = applyPend(await pull()); S.games.forEach(R.refresh); } catch (e) {}
    S.st = 'ok'; flush();
  } catch (e) {
    var ec = String(e.message || e);
    S.msg = /^\d+$/.test(ec) ? 'Помилка ' + ec + ' для ' + repo + (ec === '401' ? ': токен недійсний або скопійований не повністю' : ': токен не має доступу до цього репозиторію або назва неправильна') : 'Немає зв’язку з GitHub, спробуйте ще раз';
  }
  render();
}
async function boot() {
  if (!canW()) {
    var m = {};
    (L0.games || []).concat(Object.keys(P.g).map(id => P.g[id])).forEach(g => { if (!m[g.id] || (g.updated || 0) >= (m[g.id].updated || 0)) m[g.id] = g; });
    S.games = Object.keys(m).map(id => m[id]); S.games.forEach(R.refresh);
    P = { g: {}, del: [] }; sv('rp_pend', P); sv('rp_v1', { games: S.games }); S.st = 'off'; render(); return;
  }
  (L0.games || []).forEach(g => { P.g[g.id] = g; }); localStorage.removeItem('rp_v1'); sv('rp_pend', P);
  S.games = Object.keys(P.g).map(id => P.g[id]); S.games.forEach(R.refresh); render();
  try { S.games = applyPend(await pull()); S.st = 'ok'; } catch (e) { S.st = 'err'; }
  S.games.forEach(R.refresh); render(); flush();
}
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(tm); flush(); } else if (!busy && !pend()) refresh(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

/* ---------- інтерфейс ---------- */
function btn(a, t, c, dis, ex) { return '<button class="btn ' + (c || '') + '" data-a="' + a + '"' + (dis ? ' disabled' : '') + (ex || '') + '>' + t + '</button>'; }
function bar(t, right) { return '<div class="bar"><button class="ic" data-a="menu">‹</button><h1>' + t + '</h1>' + (right || '') + '</div>'; }
function menu() {
  var un = S.games.filter(g => !g.finished).length;
  return '<div class="hero"><div class="logo">♠</div><h1>Розписний покер</h1></div>' + btn('new', 'Нова гра') + btn('cont', 'Продовжити гру' + (un ? ' (' + un + ')' : ''), '', !un) +
    btn('hist', 'Історія ігор', 'sec') + btn('stat', 'Статистика', 'sec') + btn('sett', 'Налаштування', 'sec') +
    '<p class="mut" style="text-align:center"><span id="st">' + stTxt() + '</span>' + (!C.tok ? '<br>Ігри зберігаються лише на цьому пристрої. Щоб синхронізувати їх через GitHub, додайте токен у налаштуваннях.' : '') + '</p>';
}
function newv() {
  var d = S.draft;
  return bar('Нова гра') + '<div class="card"><label class="lb">Гравці</label>' +
    d.names.map((n, i) => '<input class="in" data-i="' + i + '" value="' + esc(n) + '" maxlength="16" placeholder="Гравець ' + (i + 1) + '">').join('') +
    '<label class="lb">Хто заходить першим</label><div class="chips">' +
    d.names.map((n, i) => '<button class="chip' + (d.first === i ? ' on' : '') + '" data-a="first" data-i="' + i + '">' + esc(n || 'Гравець ' + (i + 1)) + '</button>').join('') +
    '</div><label class="sw"><span>Прихований режим</span><input type="checkbox" id="hid"' + (d.hidden ? ' checked' : '') + '></label></div>' + btn('start', 'Почати гру');
}
function row(g, k, run) {
  var r = g.rounds[k], on = k <= g.cur, dl = R.dealer(g, k);
  var c = '<div class="row' + (k === g.cur ? ' cur' : '') + (on ? '' : ' dim') + '"' + (on ? ' data-a="edit" data-i="' + k + '"' : '') + '><div class="rl t' + r.type + '">' + R.label(r) + '</div>';
  g.names.forEach(function (_, p) {
    var b = r.bids[p], t = r.tricks[p], sm = '', big = '';
    if (r.done) { big = run[p]; sm = (R.hasBids(r) ? b + '/' : '') + t; }
    else if (b !== null) sm = (R.hasBids(r) ? (g.hidden ? '✓' : b) + '/' : '') + '-';
    c += '<div class="m' + (on && p === dl ? ' dl' : '') + '">' + sm + '</div><b class="' + (big < 0 ? 'neg' : '') + '">' + big + '</b>';
  });
  return c + '</div>';
}
function info(r, ph) {
  return r.type === 'T' ? (ph === 'bid' ? 'Темна: ставки до роздачі' : 'Тепер роздайте карти') : r.type === 'Z' ? 'Золота: +10 за взятку' : r.type === 'B' ? 'Безкозирка' : '';
}
function gamev(g) {
  var ph = R.phase(g), Ld = R.leaders(g), i = g.cur, run = g.names.map(() => 0), r = g.rounds[i];
  var t = '<div class="bar"><button class="ic" data-a="menu">‹</button><h1>' + (r ? 'Раунд ' + (i + 1) + ' · ' + r.cards + ' карт' : 'Підсумок') + '</h1><span class="rt" id="st">' + stTxt() + '</span></div>' +
    '<div class="tbl"><div class="row head"><div></div>' + g.names.map((n, p) => '<div class="nm' + (Ld.indexOf(p) > -1 ? ' lead' : '') + '">' + (r && p === R.dealer(g, i) ? '● ' : '') + esc(n) + '</div>').join('') + '</div>';
  g.rounds.forEach(function (x, k) { if (x.done) g.names.forEach(function (_, p) { run[p] += R.roundScore(x, p); }); t += row(g, k, run); });
  t += '</div><footer class="bot">';
  if (ph === 'end') t += '<div class="dn">Переможець: <b>' + Ld.map(p => esc(g.names[p])).join(', ') + '</b></div>' + btn('fin', 'Завершити гру');
  else t += '<div class="dn">Роздає: <b>' + esc(g.names[R.dealer(g, i)]) + '</b>' + (info(r, ph) ? ' · ' + info(r, ph) : '') + '</div>' + btn('sh', ph === 'bid' ? 'Ставка · ' + esc(g.names[R.actor(g)]) : 'Ввести взятки');
  return t + '</footer>' + (S.sh && ph !== 'end' && !S.edit ? sheet(g, ph) : '');
}
function trEff(g) {
  var r = g.rounds[g.cur], k = g.id + '|' + g.cur;
  if (!S.tr || S.tr.k !== k) S.tr = { k: k, v: r.tricks.slice() };
  var v = S.tr.v, ev = v.slice(), auto = -1, nl = v.filter(x => x === null).length;
  if (nl === 1) { var ai = v.indexOf(null), q = r.cards - v.reduce((s, x) => s + (x || 0), 0); if (q >= 0) { ev[ai] = q; auto = ai; } }
  return { v: v, ev: ev, auto: auto, ok: ev.every(x => x !== null) && ev.reduce((s, x) => s + x, 0) === r.cards };
}
function tricksBody(g, r) {
  var e = trEff(g), h = '';
  g.names.forEach(function (n, p) {
    var o = 0; e.v.forEach(function (x, q) { if (q !== p) o += x || 0; });
    h += '<div class="tr"><div class="n">' + esc(n) + '</div><div class="chs">';
    for (var k = 0; k <= r.cards; k++) h += '<button class="' + (e.ev[p] === k ? (e.auto === p ? 'on auto' : 'on') : '') + '" data-a="tpick" data-p="' + p + '" data-v="' + k + '"' + (k > r.cards - o ? ' disabled' : '') + '>' + k + '</button>';
    h += '</div></div>';
  });
  if (e.ev.every(x => x !== null) && !e.ok) h += '<p class="err">Сума взяток має бути ' + r.cards + '</p>';
  return h + btn('tdone', 'Готово', '', !e.ok, ' style="margin-top:14px"');
}
function sheet(g, ph) {
  var r = g.rounds[g.cur], p = R.actor(g), key = g.cur + '|' + ph + '|' + p, inf = info(r, ph);
  var h = '<div class="mask"><div class="sheet"><div class="sh"><h2>' + (ph === 'bid' ? 'Ставка · ' + esc(g.names[p]) : 'Скільки взяток узяв кожен') + '</h2><button class="tx" data-a="shx">Закрити</button></div>' +
    '<div class="cap2">Роздає: ' + esc(g.names[R.dealer(g, g.cur)]) + (inf ? ' · ' + inf : '') + '</div>';
  if (ph === 'tricks') return h + tricksBody(g, r) + '</div></div>';
  if (g.hidden && S.unl !== key) return h + '<p class="mut">Передайте телефон гравцю. Інші не дивляться.</p>' + btn('unl', 'Я готовий(а)') + '</div></div>';
  var o = '';
  for (var v = 0; v <= r.cards; v++) o += '<button data-a="pick" data-v="' + v + '"' + (R.can(g, ph, p, v) ? '' : ' disabled') + '>' + v + '</button>';
  return h + '<div class="pad">' + o + '</div></div></div>';
}
function stp(k, p, v) {
  var a = ' data-a="stp" data-k="' + k + '" data-p="' + p + '" data-d=';
  return '<span class="stp"><button' + a + '"-1">−</button><b>' + (v === null ? '–' : v) + '</b><button' + a + '"1">+</button></span>';
}
function modal(g) {
  var e = S.edit, r = g.rounds[e.i], z = !R.hasBids(r);
  return '<div class="mask"><div class="sheet"><div class="sh"><h2>Раунд ' + (e.i + 1) + ' · ' + R.label(r) + ' (' + r.cards + ' карт)</h2></div><div class="st h"><span></span><span>' + (z ? '' : 'Ставка') + '</span><span>Взятки</span></div>' +
    R.order(g, e.i).map(p => '<div class="st"><b>' + esc(g.names[p]) + '</b>' + (z ? '<span></span>' : stp('bids', p, e.bids[p])) + stp('tricks', p, e.tricks[p]) + '</div>').join('') +
    (e.err ? '<p class="err">' + e.err + '</p>' : '') + '<div class="two">' + btn('ecancel', 'Скасувати', 'sec') + btn('esave', 'Зберегти') + '</div></div></div>';
}
function pager(n, ps) {
  var pages = Math.max(1, Math.ceil(n / ps)); S.pg = Math.max(0, Math.min(S.pg, pages - 1));
  return pages > 1 ? '<div class="pager"><button class="ic" data-a="pg" data-d="-1"' + (S.pg ? '' : ' disabled') + '>‹</button><span>' + (S.pg + 1) + ' / ' + pages + '</span><button class="ic" data-a="pg" data-d="1"' + (S.pg < pages - 1 ? '' : ' disabled') + '>›</button></div>' : '';
}
function hist() {
  var l = S.games.slice().sort((a, b) => b.created - a.created), ps = 5, pg = pager(l.length, ps);
  return bar('Історія ігор', '<button class="ic" data-a="ref">↻</button>') + '<div class="fill">' + (l.length ? l.slice(S.pg * ps, S.pg * ps + ps).map(g => {
    var T = R.totals(g), Ld = R.leaders(g);
    return '<div class="card h" data-a="open" data-id="' + g.id + '"><div class="hm"><div class="gh"><b>' + fdate(g.created) + '</b><span class="badge' + (g.finished ? '' : ' live') + '">' + (g.finished ? 'Завершена' : 'Триває · раунд ' + Math.min(g.cur + 1, g.rounds.length)) + '</span></div>' +
      (g.finished ? '<div class="sm">🏆 ' + Ld.map(p => esc(g.names[p])).join(', ') + '</div>' : '') +
      '<div class="pl">' + g.names.map((x, p) => '<span>' + esc(x) + ' <b>' + T[p] + '</b></span>').join('') + '</div></div><button class="ic" data-a="rm" data-id="' + g.id + '">✕</button></div>';
  }).join('') : '<p class="mut">Ігор ще немає. Створіть першу в головному меню.</p>') + '</div>' + pg;
}
function statv() {
  var s = R.stats(S.games), ps = 8, pg = pager(s.length, ps);
  return bar('Статистика') + '<div class="fill">' + (s.length ? '<div class="tbl"><div class="row s5 head"><div>Гравець</div><div>Ігор</div><div>Перем.</div><div>Сер.</div><div>Макс.</div></div>' +
    s.slice(S.pg * ps, S.pg * ps + ps).map(x => '<div class="row s5"><div>' + esc(x.name) + '</div><div>' + x.games + '</div><div><b>' + x.wins + '</b></div><div>' + x.avg + '</div><div>' + x.best + '</div></div>').join('') + '</div>' :
    '<p class="mut">Статистика з’явиться після першої завершеної гри.</p>') + '</div>' + pg;
}
function sett() {
  return bar('Налаштування') + '<div class="card"><label class="lb">Імена гравців за замовчуванням</label><div class="nrow">' +
    S.set.names.map((n, i) => '<input class="in" data-s="' + i + '" value="' + esc(n) + '" maxlength="16">').join('') + '</div></div>' +
    '<div class="card"><label class="lb">Приватне сховище GitHub' + (C.tok ? ' · токен є' : '') + '</label><input class="in" type="password" data-c="tok" placeholder="' + (C.tok ? 'токен збережено' : 'токен github_pat_…') + '" autocomplete="off">' +
    '<input class="in" data-c="repo" value="' + esc(S.cd.repo) + '" placeholder="логін/репозиторій" autocapitalize="off">' + (S.msg ? '<p class="mut">' + esc(S.msg) + '</p>' : '') + '</div>' +
    btn('conn', C.tok ? 'Оновити підключення' : 'Підключити') + (C.tok ? btn('disc', 'Видалити токен з пристрою', 'sec') : '') +
    '<p class="mut" style="font-size:13px">Без токена ігри зберігаються лише на цьому пристрої. З токеном вони синхронізуються з приватним репозиторієм GitHub і на пристрої не лишаються.</p>';
}
function render() {
  var g = G(), v = S.view, h;
  if (v === 'new') h = newv(); else if (v === 'game' && g) h = gamev(g); else if (v === 'hist') h = hist();
  else if (v === 'stat') h = statv(); else if (v === 'sett') h = sett(); else h = menu();
  $.className = v === 'game' && g ? 'gv' : '';
  $.innerHTML = h + (S.edit && g ? modal(g) : '');
  if (prev !== v) { window.scrollTo(0, 0); prev = v; }
}
function open(id) { var g = S.games.find(x => x.id === id); S.gid = id; S.view = 'game'; S.unl = null; S.edit = null; S.tr = null; S.sh = !!g && R.phase(g) === 'bid'; }
function act(a, d) {
  var g = G();
  switch (a) {
    case 'menu': S.view = 'menu'; S.edit = null; break;
    case 'new': S.draft = { names: S.set.names.slice(), first: 0, hidden: false }; S.view = 'new'; break;
    case 'first': S.draft.first = +d.i; break;
    case 'start':
      var ng = R.newGame(S.draft.names.map((x, i) => x.trim() || 'Гравець ' + (i + 1)), S.draft.first, S.draft.hidden);
      R.refresh(ng); S.games.push(ng); open(ng.id); dirty(ng); break;
    case 'cont':
      var u = S.games.filter(x => !x.finished).sort((x, y) => (y.updated || 0) - (x.updated || 0))[0];
      if (u) open(u.id); break;
    case 'hist': case 'stat': case 'sett': S.view = a; S.pg = 0; break;
    case 'pg': S.pg += +d.d; break;
    case 'ref': refresh(); break;
    case 'open': open(d.id); break;
    case 'rm': drop(d.id); break;
    case 'conn': conn(); return;
    case 'disc':
      if (confirm('Видалити токен з цього пристрою? Ігри залишаться в GitHub, але тут не будуть видні.')) {
        S.games = Object.keys(P.g).map(id => P.g[id]); P = { g: {}, del: [] }; sv('rp_pend', P); sv('rp_v1', { games: S.games });
        C = { repo: C.repo }; sv('rp_cfg', C); S.st = 'off'; S.msg = '';
      }
      break;
    case 'sh': S.sh = true; break;
    case 'shx': S.sh = false; break;
    case 'unl': S.unl = g.cur + '|' + R.phase(g) + '|' + R.actor(g); break;
    case 'pick': R.setBid(g, R.actor(g), +d.v); S.sh = R.phase(g) === 'bid'; dirty(g); break;
    case 'tpick': var te = trEff(g), tp = +d.p, tv = +d.v; te.v[tp] = te.v[tp] === tv ? null : tv; break;
    case 'tdone':
      var td = trEff(g);
      if (td.ok) { g.rounds[g.cur].tricks = td.ev.slice(); S.tr = null; R.refresh(g); S.sh = false; dirty(g); } break;
    case 'fin': g.finished = true; g.finishedAt = Date.now(); S.view = 'hist'; dirty(g); break;
    case 'edit':
      var i = +d.i, r = g.rounds[i];
      if (g.hidden && !r.done && i === g.cur) { alert('У прихованому режимі поточний раунд можна змінити після його завершення.'); break; }
      S.edit = { i: i, bids: r.bids.slice(), tricks: r.tricks.slice(), err: '' }; break;
    case 'stp':
      var e = S.edit, arr = e[d.k], q = +d.p, c = g.rounds[e.i].cards, cv = arr[q];
      arr[q] = +d.d > 0 ? (cv === null ? 0 : Math.min(c, cv + 1)) : (cv === null || cv === 0 ? null : cv - 1); break;
    case 'ecancel': S.edit = null; break;
    case 'esave':
      var ed = S.edit, rr = g.rounds[ed.i], ob = rr.bids, ot = rr.tricks, wasDone = rr.done;
      rr.bids = ed.bids.slice(); rr.tricks = ed.tricks.slice();
      var err = R.validate(g, ed.i);
      if (!err && wasDone && !R.complete(g, ed.i)) err = 'Завершений раунд: заповніть усі значення, сума взяток = ' + rr.cards;
      if (err) { rr.bids = ob; rr.tricks = ot; ed.err = err; }
      else { R.refresh(g); S.edit = null; S.tr = null; dirty(g); }
      break;
  }
  render();
}
$.addEventListener('click', function (e) { var t = e.target.closest('[data-a]'); if (t) act(t.dataset.a, t.dataset); });
$.addEventListener('input', function (e) {
  var t = e.target;
  if (t.dataset.i != null && S.draft) S.draft.names[+t.dataset.i] = t.value;
  else if (t.id === 'hid') S.draft.hidden = t.checked;
  else if (t.dataset.s != null) { S.set.names[+t.dataset.s] = t.value; sv('rp_set', S.set); }
  else if (t.dataset.c) S.cd[t.dataset.c] = t.value;
});
boot();
})();
