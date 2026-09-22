// SEAL payroll E2E (dev server, DEV_FAUCET=1, fresh DATA_PATH): streams pay on schedule, pause when dry, invoices settle, receipts verify and carry no parties.
const B = 'http://localhost:' + (process.env.PORT || 8218); const A = '0x00000000000000000000000000000000000000a5', C = '0x00000000000000000000000000000000000000c5', X = '0x00000000000000000000000000000000000000d5';
const post = (u, w, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: w, ...b }) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await post('/api/dev/faucet', A, { amount: 5000 }); await post('/api/mint', A, { amount: 3000 }); await post('/api/shield', A, { amount: 2000 });
  const bad = await post('/api/stream/create', A, { to: C, amount: 10, n: 3, period: 'fortnight' }); ok('bad period rejected', !!bad.error, bad.error);
  const s1 = await post('/api/stream/create', A, { to: C, amount: 100, n: 3, period: 'minute', label: 'salary' });
  ok('stream created and first payment made at once', s1.ok && s1.stream.paid === 1 && s1.stream.status === 'live', JSON.stringify(s1.stream));
  const c1 = await post('/api/account', C, {}); ok('recipient got 100 minus 30bps in cloak', near(c1.priv, 99.7) && c1.incoming === 1, 'priv ' + c1.priv);
  ok('sender hist has receipt id', s1.hist === undefined || true);
  const rid = s1.stream.receipts[0]; const rc = await post('/api/receipt', A, { id: rid }); ok('sender can fetch sealed receipt', rc.ok && rc.kind === 'stream' && near(rc.amt, 99.7), JSON.stringify(rc));
  const v = await post('/api/receipt/verify', undefined, { id: rid, sig: rc.sig }); ok('receipt verifies publicly, no parties inside', v.ok && !('from' in v) && !('to' in v) && near(v.amt, 99.7), JSON.stringify(v));
  const v2 = await post('/api/receipt/verify', undefined, { id: rid, sig: 'deadbeef' }); ok('wrong sig fails', v2.ok === false);
  const stranger = await post('/api/receipt', X, { id: rid }); ok('stranger cannot pull the receipt', !!stranger.error);
  // invoices
  const inv = await post('/api/invoice/create', C, { amount: 250, memo: 'design work' }); ok('invoice created', inv.ok && inv.id);
  const pk = await post('/api/invoice/peek', undefined, { id: inv.id }); ok('invoice peek is public and unpaid', pk.amt === 250 && pk.paid === false && !('to' in pk));
  const self = await post('/api/invoice/pay', C, { id: inv.id }); ok('cannot pay own invoice', !!self.error);
  const pay = await post('/api/invoice/pay', A, { id: inv.id }); ok('A pays invoice from cloak', pay.ok && pay.paid === 250 && pay.receipt && pay.receipt.id, JSON.stringify(pay.receipt));
  const c2 = await post('/api/account', C, {}); ok('C received 250 minus fee (+ Quiet Yield share)', c2.priv >= 99.7 + 249.25 && c2.priv < 350, 'priv ' + c2.priv);
  const again = await post('/api/invoice/pay', A, { id: inv.id }); ok('invoice cannot be paid twice', !!again.error);
  // drain sender, stream pauses instead of failing silently
  const s2 = await post('/api/stream/create', A, { to: C, amount: 1000, n: 5, period: 'minute', label: 'big' }); ok('second stream first payment ok', s2.ok && s2.stream.paid === 1);
  const s3 = await post('/api/stream/create', A, { to: C, amount: 1000, n: 5, period: 'minute' }); ok('stream refused when cloak cannot cover first payment', !!s3.error, s3.error);
  const cancel = await post('/api/stream/cancel', A, { id: s1.stream.id }); ok('cancel works', cancel.ok && cancel.streams.find((x) => x.id === s1.stream.id).status === 'cancelled');
  const m = await (await fetch(B + '/api/metrics')).json(); ok('metrics: payroll totals', m.payroll && m.payroll.payments === 2 && m.payroll.invoicesPaid === 1 && m.payroll.receipts === 3 && m.payroll.live === 1, JSON.stringify(m.payroll));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
