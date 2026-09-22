// Full ledger flow with the dev faucet (DEV_FAUCET=1, HAPPY_START=1 locally).
const B = 'http://localhost:8218'; const W = '0x00000000000000000000000000000000000000b2';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: W, ...b }) }).then((r) => r.json());
const ok = (name, cond, extra) => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  · ' + extra : ''));
const f = (n) => Math.round(n * 100) / 100;
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const m0 = await (await fetch(B + '/api/metrics')).json();
  ok('happy live locally', m0.happy.live === true, 'endsIn ' + Math.round(m0.happy.endsIn / 864e5) + 'd');
  const fa = await post('/api/dev/faucet', { amount: 1000 }); ok('faucet credited 1000 USDG', fa.usdg === 1000);
  const p0 = m0.shred.svcUsd;
  const mt = await post('/api/mint', { amount: 500 });
  ok('mint 500 sUSD costs 500 USDG total', mt.ok && f(mt.usdg) === 500 && f(mt.susd) === 500, `usdg=${f(mt.usdg)} susd=${f(mt.susd)} collat=${f(mt.usedUsdg)} algo=${f(mt.algoUsd)}`);
  ok('mint: collateral + algo slice == 500', f(mt.usedUsdg + mt.algoUsd) === 500);
  const m1 = await (await fetch(B + '/api/metrics')).json();
  ok('algo slice went to the shred (or already burned)', m1.shred.svcUsd >= p0 || m1.shred.epochs > m0.shred.epochs, `service charge ${f(p0)} → ${f(m1.shred.svcUsd)} epochs ${m0.shred.epochs}→${m1.shred.epochs}`);
  const st = await post('/api/stake', { amount: 200 }); ok('stake 200', st.ok && f(st.susd) === 300 && f(st.happy.staked) === 200, JSON.stringify(st.happy));
  await new Promise((r) => setTimeout(r, 3000));
  const ac = await post('/api/account', {}); ok('reward accrues in sUSD terms', ac.happy.accruedUsd > 0 && ac.happy.accruedSeal > 0, `accruedUsd=${ac.happy.accruedUsd.toExponential(2)} accruedSeal=${f(ac.happy.accruedSeal)}`);
  const cl = await post('/api/claim', {}); ok('claim gated below $0.01 or pays SEAL', cl.error === 'nothing to claim yet' || (cl.ok && cl.claimedSeal > 0), cl.error || 'claimed ' + f(cl.claimedSeal));
  const us = await post('/api/unstake', { amount: 200 }); ok('unstake 200 minus 30bps service charge', us.ok && f(us.unstaked) === 199.4 && f(us.fee) === 0.6, `back ${f(us.unstaked)} susd=${f(us.susd)}`);
  const rd = await post('/api/redeem', { amount: 100 }); ok('redeem 100 sUSD pays CR in USDG (net of 50bps)', rd.ok && rd.gotUsdg > 0, `usdg +${f(rd.gotUsdg)} seal +${f(rd.gotSeal)} now usdg=${f(rd.usdg)}`);
  const wd = await post('/api/withdraw', { amount: 50 }); ok('withdraw 50 → queue', wd.ok && wd.queued.status === 'queued' && f(wd.usdg) === f(rd.usdg - 50), 'id ' + wd.queued.id);
  const m2 = await (await fetch(B + '/api/metrics')).json(); ok('metrics shows open queue', m2.queue.open >= 1 && m2.queue.openUsd >= 50, JSON.stringify(m2.queue));
  const cap = await post('/api/stake', { amount: 999999 }); ok('stake over balance clamps to balance (MAX semantics)', cap.ok && f(cap.happy.staked) > 0, 'staked ' + f(cap.happy.staked));
})();
