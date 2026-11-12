const R = require('./logic.js'), a = require('assert');
a.strictEqual(R.score('N', 3, 3), 30); a.strictEqual(R.score('N', 3, 1), -20); a.strictEqual(R.score('N', 2, 4), 4);
a.strictEqual(R.score('N', 0, 0), 5); a.strictEqual(R.score('N', 0, 2), 2); a.strictEqual(R.score('Z', 0, 4), 40);
const g = R.newGame(['A', 'B', 'C'], 0, false); R.refresh(g);
g.rounds[11].bids = [6, null, 6]; a.ok(!R.bidAllowed(g, 11, 1, 0)); a.ok(R.bidAllowed(g, 11, 1, 1));
R.setBid(g, 0, 0); R.setBid(g, 1, 0); a.ok(!R.bidAllowed(g, 0, 2, 1)); R.setBid(g, 2, 0);
R.setTricks(g, 0, 1); R.setTricks(g, 1, 0); R.setTricks(g, 2, 0);
a.strictEqual(g.cur, 1); a.deepStrictEqual(R.totals(g), [1, 5, 5]); a.deepStrictEqual(R.leaders(g), [1, 2]);
g.rounds[1].tricks = [2, 1, 1]; a.ok(R.validate(g, 1)); console.log('OK');
