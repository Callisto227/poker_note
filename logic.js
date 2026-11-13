(function (g) {
'use strict';
var LBL = { B: 'Б', T: 'Т', Z: 'З' };
var mk = (c, t) => ({ cards: c, type: t, bids: [null, null, null], tricks: [null, null, null], done: false });
function buildRounds() {
  var r = [], i;
  for (i = 1; i <= 11; i++) r.push(mk(i, 'N'));
  for (i = 0; i < 3; i++) r.push(mk(12, 'N'));
  for (i = 11; i >= 1; i--) r.push(mk(i, 'N'));
  ['B', 'T', 'Z'].forEach(function (t) { r.push(mk(12, t)); });
  return r;
}
function newGame(names, first, hidden) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), names: names, first: first,
    hidden: !!hidden, created: Date.now(), updated: Date.now(), finished: false, cur: 0, rounds: buildRounds() };
}
var label = r => r.type === 'N' ? String(r.cards) : LBL[r.type];
var hasBids = r => r.type !== 'Z';
var sum = a => a.reduce((s, v) => s + (v || 0), 0);
function addSpecial(gm, t) { gm.rounds.push(mk(12, t)); }
function order(gm, i) {
  var n = gm.names.length, o = [];
  for (var k = 0; k < n; k++) o.push((gm.first + i + k) % n);
  return o;
}
var dealer = (gm, i) => { var o = order(gm, i); return o[o.length - 1]; };
function score(type, bid, tr) {
  if (type === 'Z') return tr * 10;
  if (bid === 0) return tr === 0 ? 5 : tr;
  if (tr === bid) return bid * 10;
  return tr < bid ? -10 * (bid - tr) : tr;
}
function bidAllowed(gm, i, p, v) {
  var r = gm.rounds[i];
  if (!hasBids(r) || !Number.isInteger(v) || v < 0 || v > r.cards) return false;
  var o = order(gm, i);
  if (o[o.length - 1] === p) {
    var s = 0;
    o.forEach(q => { if (q !== p) s += r.bids[q] || 0; });
    if (s + v === r.cards) return false;
  }
  return true;
}
function validate(gm, i) {
  var r = gm.rounds[i], n = gm.names.length, p, ok = x => x === null || (Number.isInteger(x) && x >= 0 && x <= r.cards);
  if (hasBids(r)) {
    if (!r.bids.every(ok)) return 'Ставка поза межами 0–' + r.cards;
    if (r.bids.every(b => b !== null)) {
      p = order(gm, i)[n - 1];
      if (!bidAllowed(gm, i, p, r.bids[p])) return 'Сума ставок не може дорівнювати ' + r.cards + ' (кількість карт)';
    }
  }
  if (!r.tricks.every(ok)) return 'Взятки поза межами 0–' + r.cards;
  if (sum(r.tricks) > r.cards) return 'Сума взяток більша за ' + r.cards;
  if (r.tricks.every(t => t !== null) && sum(r.tricks) !== r.cards) return 'Сума взяток має дорівнювати ' + r.cards;
  return null;
}
function complete(gm, i) {
  var r = gm.rounds[i];
  if (validate(gm, i)) return false;
  if (hasBids(r) && r.bids.some(b => b === null)) return false;
  return r.tricks.every(t => t !== null) && sum(r.tricks) === r.cards;
}
function refresh(gm) {
  gm.rounds.forEach((r, i) => { r.done = complete(gm, i); });
  var k = gm.rounds.findIndex(r => !r.done);
  gm.cur = k < 0 ? gm.rounds.length : k;
  return gm;
}
function phase(gm) {
  var r = gm.rounds[gm.cur];
  if (!r) return 'end';
  if (hasBids(r) && r.bids.some(b => b === null)) return 'bid';
  return r.tricks.some(t => t === null) ? 'tricks' : 'fix';
}
function actor(gm) {
  var r = gm.rounds[gm.cur], a = phase(gm) === 'bid' ? r.bids : r.tricks;
  return order(gm, gm.cur).find(p => a[p] === null);
}
function can(gm, ph, p, v) {
  var r = gm.rounds[gm.cur];
  if (ph === 'bid') return bidAllowed(gm, gm.cur, p, v);
  if (gm.hidden) return true;
  var s = sum(r.tricks), left = r.tricks.filter(t => t === null).length;
  return left === 1 ? s + v === r.cards : s + v <= r.cards;
}
function setBid(gm, p, v) { gm.rounds[gm.cur].bids[p] = v; refresh(gm); }
function setTricks(gm, p, v) { gm.rounds[gm.cur].tricks[p] = v; refresh(gm); }
function resetTricks(gm) { gm.rounds[gm.cur].tricks = gm.names.map(() => null); refresh(gm); }
var roundScore = (r, p) => r.done ? score(r.type, hasBids(r) ? r.bids[p] : 0, r.tricks[p]) : null;
var totals = gm => gm.names.map((_, p) => gm.rounds.reduce((s, r) => s + (r.done ? roundScore(r, p) : 0), 0));
function leaders(gm) {
  if (!gm.rounds.some(r => r.done)) return [];
  var T = totals(gm), m = Math.max.apply(null, T);
  return T.map((v, p) => v === m ? p : -1).filter(p => p >= 0);
}
function stats(games, players, pidf) {
  var m = {}, pn = {};
  (players || []).forEach(p => { pn[p.id] = p.name; });
  games.forEach(gm => {
    if (!gm.finished) return;
    var T = totals(gm), L = leaders(gm);
    gm.names.forEach((n, p) => {
      var k = (gm.pids && gm.pids[p]) || (pidf ? pidf(n) : n.trim().toLowerCase()), s = m[k] || (m[k] = { name: pn[k] || n, games: 0, wins: 0, sum: 0, best: -Infinity });
      s.games++; s.sum += T[p]; if (L.indexOf(p) > -1) s.wins++; if (T[p] > s.best) s.best = T[p];
    });
  });
  return Object.keys(m).map(k => ({ name: m[k].name, games: m[k].games, wins: m[k].wins,
    avg: Math.round(m[k].sum / m[k].games), best: m[k].best })).sort((a, b) => b.wins - a.wins || b.avg - a.avg);
}
var api = { dealer, newGame, label, hasBids, addSpecial, order, score, bidAllowed, validate, complete, refresh, phase, actor, can,
  setBid, setTricks, resetTricks, roundScore, totals, leaders, stats };
if (typeof module !== 'undefined') module.exports = api; else g.RP = api;
})(this);
