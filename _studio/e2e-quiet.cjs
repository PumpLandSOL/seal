// QUIET YIELD E2E (dev server, DEV_FAUCET=1, fresh DATA_PATH): fee share streams to cloaked holders pro-rata, conserved, only from real wallets.
const B = 'http://localhost:' + (process.env.PORT || 8218); const A = '0x00000000000000000000000000000000000000f1', C = '0x00000000000000000000000000000000000000f2', D = '0x00000000000000000000000000000000000000f3';
const post = (u, w, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: w, ...b }) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
(async () => {
  for (const w of [A, C, D]) { await post('/api/dev/faucet', w, { amount: 10000 }); await post('/api/mint', w, { amount: 5000 }); }
  const m0 = await (await fetch(B + '/api/metrics')).json(); ok('metrics expose quiet at 40%', m0.quiet && m0.quiet.cut === 0.4, JSON.stringify(m0.quiet));
  ok('background activity paid nobody', m0.quiet.paid === 0 && m0.quiet.holders === 0);
  // A cloaks 3000 first: A is not yet a holder when the fee is charged, no holders -> nothing paid
  const a1 = await post('/api/shield', A, { amount: 3000 }); ok('first cloak: no holders yet, nothing streamed', near(a1.priv, 3000 * 0.997) && a1.quietEarned === 0, 'priv ' + a1.priv);
  // C cloaks 1000: fee 3, 40% = 1.2 -> all to A (only holder at that moment)
  const c1 = await post('/api/shield', C, { amount: 1000 }); const a2 = await post('/api/account', A, {});
  ok('C cloak fee streams 40% to A', near(a2.quietEarned, 1.2) && near(a2.priv, 2991 + 1.2), 'A earned ' + a2.quietEarned);
  ok('C not paid from own entry fee', c1.quietEarned === 0 && near(c1.priv, 997));
  // D sends nothing, just cloaks 2000: fee 6, 40% = 2.4 split A:C by balance
  await post('/api/shield', D, { amount: 2000 }); const a3 = await post('/api/account', A, {}), c3 = await post('/api/account', C, {});
  const ta = 2992.2, tc = 997, tot = ta + tc; ok('pro-rata split', near(a3.quietEarned - 1.2, 2.4 * ta / tot, 1e-5) && near(c3.quietEarned, 2.4 * tc / tot, 1e-5), 'A +' + (a3.quietEarned - 1.2).toFixed(4) + ' C +' + c3.quietEarned.toFixed(4));
  const m1 = await (await fetch(B + '/api/metrics')).json(); ok('totals: paid 3.6, 3 holders, 2 payouts, apr > 0', near(m1.quiet.paid, 3.6) && m1.quiet.holders === 3 && m1.quiet.payouts === 2 && m1.quiet.apr > 0, JSON.stringify(m1.quiet));
  // earned sUSD is real: A uncloaks everything and redeems
  const u = await post('/api/unshield', A, { amount: a3.priv }); ok('earned sUSD uncloaks like any other', u.ok && u.susd > 2000 + 2980, 'susd ' + u.susd.toFixed(2));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
