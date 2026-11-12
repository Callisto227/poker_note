(function () {
'use strict';
var R = window.RP, K = 'rp_v1', $ = document.getElementById('app');
var S = { games: [], set: { names: ['Гравець 1', 'Гравець 2', 'Гравець 3'] }, view: 'menu', gid: null, draft: null, unl: null, edit: null };
try { var d0 = JSON.parse(localStorage.getItem(K) || 'null'); if (d0) { S.games = d0.games || []; S.set = d0.set || S.set; } } catch (e) {}
S.games.forEach(function (g) { R.refresh(g); });
function save() { try { localStorage.setItem(K, JSON.stringify({ games: S.games, set: S.set })); } catch (e) { alert('Не вдалося зберегти дані'); } }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
var esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
var G = () => S.games.find(g => g.id === S.gid);
var fdate = t => new Date(t).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
function btn(a, t, c, dis, ex) { return '<button class="btn ' + (c || '') + '" data-a="' + a + '"' + (dis ? ' disabled' : '') + (ex || '') + '>' + t + '</button>'; }
function bar(t) { return '<div class="bar"><button class="ic" data-a="menu">‹</button><h1>' + t + '</h1></div>'; }

function menu() {
  var un = S.games.filter(g => !g.finished).length;
  return '<div class="hero"><div class="logo">♠</div><h1>Розписний покер</h1></div>' + btn('new', 'Нова гра') +
    btn('cont', 'Продовжити гру' + (un ? ' (' + un + ')' : ''), '', !un) + btn('hist', 'Історія ігор', 'sec') +
    btn('stat', 'Статистика', 'sec') + btn('sett', 'Налаштування', 'sec');
}
function newv() {
  var d = S.draft;
  return bar('Нова гра') + '<div class="card"><label class="lb">Гравці</label>' +
    d.names.map((n, i) => '<input class="in" data-i="' + i + '" value="' + esc(n) + '" maxlength="16" placeholder="Гравець ' + (i + 1) + '">').join('') +
    '<label class="lb">Хто заходить першим</label><div class="chips">' +
    d.names.map((n, i) => '<button class="chip' + (d.first === i ? ' on' : '') + '" data-a="first" data-i="' + i + '">' + esc(n || 'Гравець ' + (i + 1)) + '</button>').join('') +
    '</div><label class="sw"><span>Прихований режим</span><input type="checkbox" id="hid"' + (d.hidden ? ' checked' : '') + '></label></div>' + btn('start', 'Почати гру');
}
function row(g, k, cur) {
  var r = g.rounds[k], c = '<div class="row' + (cur ? ' cur' : '') + '" data-a="edit" data-i="' + k + '"><div class="rl t' + r.type + '">' + R.label(r) + '</div>';
  g.names.forEach(function (_, p) {
    var b = r.bids[p], t = r.tricks[p], big, sm, cls = '';
    if (r.done) { var s = R.roundScore(r, p); big = (s > 0 ? '+' : '') + s; cls = s < 0 ? 'neg' : ''; sm = (R.hasBids(r) ? b + '/' : '') + t; }
    else {
      var all = !R.hasBids(r) || r.bids.every(x => x !== null);
      var bs = b === null ? '–' : (g.hidden && !all ? '✓' : b), ts = t === null ? '–' : (g.hidden ? '✓' : t);
      big = '·'; sm = (R.hasBids(r) ? bs + '/' : '') + ts;
    }
    c += '<div><b class="' + cls + '">' + big + '</b><small>' + sm + '</small></div>';
  });
  return c + '</div>';
}
function panel(g, ph) {
  if (ph === 'end') {
    var L = R.leaders(g);
    return '<div class="panel"><h2>Усі раунди зіграно</h2><p>Переможець: <b>' + L.map(p => esc(g.names[p])).join(', ') + '</b></p>' + btn('fin', 'Завершити гру') + '</div>';
  }
  var r = g.rounds[g.cur], p = R.actor(g), key = g.cur + '|' + ph + '|' + p;
  var info = r.type === 'T' ? (ph === 'bid' ? 'Темна: ставки до роздачі карт' : 'Тепер роздайте карти й грайте') :
    r.type === 'Z' ? 'Золота: кожна взятка +10' : r.type === 'B' ? 'Безкозирка' : '';
  var h = '<div class="panel">' + (info ? '<div class="tag">' + info + '</div>' : '') +
    '<h2>' + (ph === 'bid' ? 'Ставку оголошує' : 'Взятки вводить') + ': ' + esc(g.names[p]) + '</h2>';
  if (g.hidden && S.unl !== key) return h + '<p class="mut">Передайте телефон цьому гравцю. Інші не дивляться.</p>' + btn('unl', 'Я готовий(а)') + '</div>';
  var o = '';
  for (var v = 0; v <= r.cards; v++) o += '<button data-a="pick" data-v="' + v + '"' + (R.can(g, ph, p, v) ? '' : ' disabled') + '>' + v + '</button>';
  return h + '<div class="pad">' + o + '</div></div>';
}
function gamev(g) {
  var ph = R.phase(g), T = R.totals(g), L = R.leaders(g), i = g.cur;
  var t = '<div class="bar"><button class="ic" data-a="menu">‹</button><h1>' + (i < g.rounds.length ? 'Раунд ' + (i + 1) + '/' + g.rounds.length + ' · ' + g.rounds[i].cards + ' карт' : 'Підсумок') +
    '</h1><button class="ic" data-a="del">🗑</button></div><div class="tbl"><div class="row head"><div></div>' + g.names.map(n => '<div>' + esc(n) + '</div>').join('') + '</div>' +
    '<div class="row tot"><div>Σ</div>' + T.map((v, p) => '<div class="' + (L.indexOf(p) > -1 ? 'lead' : '') + '">' + v + '</div>').join('') + '</div>';
  for (var k = Math.min(i, g.rounds.length - 1); k >= 0; k--) t += row(g, k, k === i);
  t += '</div><div class="sp"><span>Додати раунд:</span><button data-a="addsp" data-t="B">Б</button><button data-a="addsp" data-t="T">Т</button><button data-a="addsp" data-t="Z">З</button></div>';
  return t + panel(g, ph);
}
function stp(k, p, v) {
  var a = ' data-a="stp" data-k="' + k + '" data-p="' + p + '" data-d=';
  return '<span class="stp"><button' + a + '"-1">−</button><b>' + (v === null ? '–' : v) + '</b><button' + a + '"1">+</button></span>';
}
function modal(g) {
  var e = S.edit, r = g.rounds[e.i], z = !R.hasBids(r);
  return '<div class="mask"><div class="sheet"><h2>Раунд ' + (e.i + 1) + ' · ' + R.label(r) + ' (' + r.cards + ' карт)</h2><div class="st h"><span></span><span>' + (z ? '' : 'Ставка') + '</span><span>Взятки</span></div>' +
    R.order(g, e.i).map(p => '<div class="st"><b>' + esc(g.names[p]) + '</b>' + (z ? '<span></span>' : stp('bids', p, e.bids[p])) + stp('tricks', p, e.tricks[p]) + '</div>').join('') +
    (e.err ? '<p class="err">' + e.err + '</p>' : '') + '<div class="two">' + btn('ecancel', 'Скасувати', 'sec') + btn('esave', 'Зберегти') + '</div></div></div>';
}
function hist() {
  var l = S.games.slice().sort((a, b) => b.created - a.created);
  return bar('Історія ігор') + (l.length ? l.map(g => {
    var T = R.totals(g), L = R.leaders(g);
    return '<div class="card"><div class="gh"><b>' + fdate(g.created) + '</b><span class="badge' + (g.finished ? '' : ' live') + '">' + (g.finished ? 'Завершена' : 'Триває · раунд ' + Math.min(g.cur + 1, g.rounds.length)) + '</span></div>' +
      (g.finished ? '<div>🏆 ' + L.map(p => esc(g.names[p])).join(', ') + '</div>' : '') +
      '<div class="pl">' + g.names.map((x, p) => '<span>' + esc(x) + '<br><b>' + T[p] + '</b></span>').join('') + '</div><div class="two">' +
      btn('open', 'Відкрити', 'sec', 0, ' data-id="' + g.id + '"') + btn('rm', 'Видалити', 'sec', 0, ' data-id="' + g.id + '"') + '</div></div>';
  }).join('') : '<p class="mut">Ігор ще немає. Створіть першу в головному меню.</p>');
}
function statv() {
  var s = R.stats(S.games);
  return bar('Статистика') + (s.length ? '<div class="tbl"><div class="row s5 head"><div>Гравець</div><div>Ігор</div><div>Перем.</div><div>Сер.</div><div>Макс.</div></div>' +
    s.map(x => '<div class="row s5"><div>' + esc(x.name) + '</div><div>' + x.games + '</div><div><b>' + x.wins + '</b></div><div>' + x.avg + '</div><div>' + x.best + '</div></div>').join('') + '</div>' :
    '<p class="mut">Статистика з’явиться після першої завершеної гри.</p>');
}
function sett() {
  return bar('Налаштування') + '<div class="card"><label class="lb">Імена гравців за замовчуванням</label>' +
    S.set.names.map((n, i) => '<input class="in" data-s="' + i + '" value="' + esc(n) + '" maxlength="16">').join('') + '</div>' +
    btn('clear', 'Видалити всі дані', 'sec') + '<p class="mut">Дані зберігаються лише на цьому пристрої.</p>';
}
var prev = '';
function render() {
  var g = G(), v = S.view, h;
  if (v === 'new') h = newv(); else if (v === 'game' && g) h = gamev(g); else if (v === 'hist') h = hist();
  else if (v === 'stat') h = statv(); else if (v === 'sett') h = sett(); else h = menu();
  $.innerHTML = h + (S.edit && g ? modal(g) : '');
  if (prev !== v) { window.scrollTo(0, 0); prev = v; }
}
function open(id) { S.gid = id; S.view = 'game'; S.unl = null; S.edit = null; }
function drop(id) { if (confirm('Видалити цю гру? Дію не можна скасувати.')) { S.games = S.games.filter(x => x.id !== id); return true; } return false; }
function act(a, d) {
  var g = G(), touch = false;
  switch (a) {
    case 'menu': S.view = 'menu'; S.edit = null; break;
    case 'new': S.draft = { names: S.set.names.slice(), first: 0, hidden: false }; S.view = 'new'; break;
    case 'first': S.draft.first = +d.i; break;
    case 'start':
      var ng = R.newGame(S.draft.names.map((x, i) => x.trim() || 'Гравець ' + (i + 1)), S.draft.first, S.draft.hidden);
      R.refresh(ng); S.games.push(ng); open(ng.id); break;
    case 'cont':
      var u = S.games.filter(x => !x.finished).sort((x, y) => (y.updated || 0) - (x.updated || 0))[0];
      if (u) open(u.id); break;
    case 'hist': case 'stat': case 'sett': S.view = a; break;
    case 'open': open(d.id); break;
    case 'rm': drop(d.id); break;
    case 'del': if (drop(S.gid)) S.view = 'hist'; break;
    case 'clear': if (confirm('Видалити всі ігри та статистику?')) { S.games = []; S.view = 'menu'; } break;
    case 'unl': S.unl = g.cur + '|' + R.phase(g) + '|' + R.actor(g); break;
    case 'pick':
      var ph = R.phase(g), p = R.actor(g), v = +d.v;
      if (ph === 'bid') R.setBid(g, p, v); else R.setTricks(g, p, v);
      if (R.phase(g) === 'fix') { alert('Сума взяток має дорівнювати ' + g.rounds[g.cur].cards + '. Введіть взятки ще раз.'); R.resetTricks(g); }
      touch = true; break;
    case 'addsp': R.addSpecial(g, d.t); R.refresh(g); touch = true; break;
    case 'fin': g.finished = true; g.finishedAt = Date.now(); S.view = 'hist'; touch = true; break;
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
      else { R.refresh(g); S.edit = null; touch = true; }
      break;
  }
  if (touch && g) g.updated = Date.now();
  save(); render();
}
$.addEventListener('click', function (e) { var t = e.target.closest('[data-a]'); if (t) act(t.dataset.a, t.dataset); });
$.addEventListener('input', function (e) {
  var t = e.target;
  if (t.dataset.i != null && S.draft) S.draft.names[+t.dataset.i] = t.value;
  else if (t.id === 'hid') S.draft.hidden = t.checked;
  else if (t.dataset.s != null) { S.set.names[+t.dataset.s] = t.value; save(); }
});
render();
})();
