// Rite III E2E: note create/peek/claim (one-shot), seal view key read-only, history. Needs dev server (DEV_FAUCET=1).
const B = 'http://localhost:8218'; const A = '0x00000000000000000000000000000000000000c3', C = '0x00000000000000000000000000000000000000d4';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const f = (n) => Math.round(n * 100) / 100;
(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  await post('/api/dev/faucet', { wallet: A, amount: 1000 }); await post('/api/mint', { wallet: A, amount: 500 }); const sh = await post('/api/shield', { wallet: A, amount: 400 });
  ok('A shielded 400 (net of service charge)', f(sh.priv) === 398.8, 'priv ' + f(sh.priv));
  const n = await post('/api/note/create', { wallet: A, amount: 100, memo: 'for the punch' });
  ok('note created, secret returned', n.ok && n.secret && n.secret.length > 10, 'amt ' + f(n.amt) + ' service charge ' + f(n.fee));
  ok('A priv debited by 100 (+ any Quiet Yield)', n.priv >= 298.8 && n.priv < 300);
  const pk = await post('/api/note/peek', { secret: n.secret }); ok('peek shows amount+memo, unclaimed', f(pk.amt) === 99.7 && pk.memo === 'for the punch' && pk.claimed === false);
  const bad = await post('/api/note/claim', { wallet: C, secret: 'nope' }); ok('bad secret rejected', bad.error === 'no such note');
  const cl = await post('/api/note/claim', { wallet: C, secret: n.secret }); ok('C claimed 99.7 into shielded', cl.ok && f(cl.claimed) === 99.7 && f(cl.priv) === 99.7);
  const cl2 = await post('/api/note/claim', { wallet: A, secret: n.secret }); ok('second claim refused', /already claimed/.test(cl2.error || ''));
  const s = await post('/api/carbon', { wallet: A }); ok('seal returns view key', s.ok && s.viewKey.length > 30, s.viewKey.slice(0, 12) + '…');
  const v = await post('/api/view', { key: s.viewKey }); ok('view key resolves to A with balance + history', v.ok && v.wallet === A && v.priv >= 298.8 && v.hist.length >= 2, 'hist types ' + v.hist.map((h) => h.type).join(','));
  const vt = await post('/api/view', { key: s.viewKey.slice(0, -1) + (s.viewKey.endsWith('1') ? '2' : '1') }); ok('tampered key rejected', vt.error === 'invalid view key');
  const vC = await post('/api/view', { key: (await post('/api/carbon', { wallet: C })).viewKey }); ok('C view shows claimed entry', vC.ok && vC.hist[0].type === 'claimed' && vC.hist[0].memo === 'for the punch');
  const spend = await post('/api/unshield', { wallet: s.viewKey, amount: 10 }); ok('view key has no spending power (not a wallet)', !!spend.error);
  const m = await (await fetch(B + '/api/metrics')).json(); ok('metrics counts notes', m.notes.created >= 1 && m.notes.claimed >= 1, JSON.stringify(m.notes));
  const page = await (await fetch(B + '/view')).text(); ok('/view page served', /Mirror|Carbon Copy|SEAL/.test(page));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
})();
