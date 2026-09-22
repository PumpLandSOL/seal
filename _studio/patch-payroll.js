// one-shot: SEAL payroll engine: Streams (scheduled cloaked payments), Invoices (claim-by-link requests), Sealed Receipts (signed proof-of-payment). Already applied; do not re-run.
const fs = require('fs'); let s = fs.readFileSync('server/index.js', 'utf8');
const rep = (a, b, t) => { if (!s.includes(a)) throw new Error('missing ' + t); s = s.replace(a, b); };

rep(`function tick() {`, `// ---------- PAYROLL: Streams + Invoices + Sealed Receipts ----------
//   Stream  : sender schedules N cloaked payments of X sUSD to a recipient every P ms. Each payment is a cloaked send (fee, nullifier, commitment); the recipient never appears on the ledger.
//   Invoice : recipient creates a request for X sUSD as a link; whoever opens it pays from cloaked balance straight into the recipient cloaked balance. The payer is never named.
//   Receipt : HMAC-SHA256(receiptSalt, id|kind|amt|ts), a signed proof that a payment happened, carrying no sender or recipient; verifiable at /api/receipt/verify.
const STREAM_MIN = 1, STREAM_MAX_N = 520; const STREAM_FEE = SVC.send;
if (!db.streams) db.streams = {}; if (!db.invoices) db.invoices = {}; if (!db.receipts) db.receipts = {}; if (!db.receiptSalt) db.receiptSalt = base58(randomBytes(32));
if (!db.payroll) db.payroll = { streamed: 0, payments: 0, invoicesPaid: 0, invoicedUsd: 0, receipts: 0 };
const PERIODS = { minute: 60e3, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 };
function receipt(kind, amt, ref) { const id = base58(randomBytes(8)); const ts = Date.now(); const sig = createHmac('sha256', db.receiptSalt).update([id, kind, amt.toFixed(6), ts].join('|')).digest('hex').slice(0, 40); db.receipts[id] = { kind, amt, ts, sig, ref }; db.payroll.receipts++; return { id, sig, ts }; }
function verifyReceipt(id, sig) { const r = db.receipts[id]; if (!r) return null; return r.sig === String(sig || '').toLowerCase() ? { ok: true, kind: r.kind, amt: r.amt, ts: r.ts } : { ok: false }; }
function payStream(st, now) {   // one scheduled payment: cloaked send from sender to recipient, fee to Quiet Yield / Erase
  const w = db.wallets[st.from]; if (!w || w.priv + 1e-9 < st.amt) { st.missed = (st.missed || 0) + 1; st.status = 'paused'; return false; }
  const net = svc('send', st.amt, w); w.priv -= st.amt; const r = W(st.to); r.priv += net; sh.nullifiers++;
  const { C, note } = shieldNote(net, shKeys[randomInt(0, shKeys.length)].pub); pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('s', sh.notes), commitment: C, note, proof: simProof(), ts: now });
  const rc = receipt('stream', net, st.id); st.paid++; st.paidUsd += net; st.next = now + st.period; st.last = now; st.receipts.unshift(rc.id); if (st.receipts.length > 60) st.receipts.pop();
  hist(w, { type: 'stream', amt: st.amt, memo: st.label, id: rc.id }); hist(r, { type: 'received', amt: net, memo: st.label, id: rc.id });
  db.payroll.streamed += net; db.payroll.payments++; if (st.paid >= st.n) st.status = 'done'; return true;
}
function runStreams(now) { let did = 0; for (const st of Object.values(db.streams)) { if (st.status !== 'live') continue; while (st.status === 'live' && now >= st.next) { if (!payStream(st, now)) break; did++; if (did > 500) return; } } }
const streamView = (st) => ({ id: st.id, label: st.label, amt: st.amt, period: st.periodName, n: st.n, paid: st.paid, paidUsd: st.paidUsd, next: st.next, status: st.status, missed: st.missed || 0, to: st.to.slice(0, 6) + '…' + st.to.slice(-4), receipts: st.receipts.slice(0, 5) });
const invoiceView = (I) => ({ id: I.id, amt: I.amt, memo: I.memo, ts: I.ts, paid: I.paid, paidTs: I.paidTs || null, receipt: I.receipt || null });
function tick() {
  runStreams(Date.now());`, 'tick');

rep(`    quiet: quietView(),`, `    quiet: quietView(), payroll: { ...db.payroll, live: Object.values(db.streams).filter((x) => x.status === 'live').length, periods: Object.keys(PERIODS), fee: STREAM_FEE, min: STREAM_MIN, maxN: STREAM_MAX_N },`, 'metrics');
rep(`quietEarned: w.quietEarned || 0, dark: darkView(w),`, `quietEarned: w.quietEarned || 0, streams: Object.values(db.streams).filter((x) => x.from === addr.toLowerCase()).map(streamView), incoming: Object.values(db.streams).filter((x) => x.to === addr.toLowerCase() && x.status === 'live').length, invoices: Object.values(db.invoices).filter((x) => x.to === addr.toLowerCase()).slice(-20).reverse().map(invoiceView), dark: darkView(w),`, 'account');

rep(`    if (u === '/api/note/peek') {`, `    if (u === '/api/invoice/peek') { const I = db.invoices[String(d.id || '')]; if (!I) return json(res, 200, { error: 'no such invoice' }); return json(res, 200, invoiceView(I)); }
    if (u === '/api/receipt/verify') { const v = verifyReceipt(String(d.id || ''), d.sig); if (!v) return json(res, 200, { error: 'no such receipt' }); return json(res, 200, v); }
    if (u === '/api/note/peek') {`, 'public routes');

rep(`    if (u === '/api/carbon') {`, `    if (u === '/api/stream/create') { // schedule N cloaked payments
      if (!isWallet(d.to || '')) return json(res, 200, { error: 'enter a valid recipient address' }); if (d.to.toLowerCase() === d.wallet.toLowerCase()) return json(res, 200, { error: 'cannot stream to yourself' });
      const amt = +d.amount || 0; if (amt < STREAM_MIN) return json(res, 200, { error: 'minimum ' + STREAM_MIN + ' sUSD per payment' }); const n = Math.min(STREAM_MAX_N, Math.max(1, Math.floor(+d.n || 1)));
      const period = PERIODS[d.period]; if (!period) return json(res, 200, { error: 'period must be minute, hour, day, week or month' }); if (w.priv + 1e-9 < amt) return json(res, 200, { error: 'not enough cloaked balance for the first payment' });
      const st = { id: base58(randomBytes(6)), from: d.wallet.toLowerCase(), to: d.to.toLowerCase(), amt, n, period, periodName: d.period, label: String(d.label || '').slice(0, 40), ts: Date.now(), next: Date.now(), paid: 0, paidUsd: 0, status: 'live', receipts: [] };
      db.streams[st.id] = st; payStream(st, Date.now()); save(); return json(res, 200, { ok: true, stream: streamView(st), ...account(d.wallet) });
    }
    if (u === '/api/stream/cancel') { const st = db.streams[String(d.id || '')]; if (!st || st.from !== d.wallet.toLowerCase()) return json(res, 200, { error: 'no such stream' }); st.status = 'cancelled'; save(); return json(res, 200, { ok: true, ...account(d.wallet) }); }
    if (u === '/api/stream/resume') { const st = db.streams[String(d.id || '')]; if (!st || st.from !== d.wallet.toLowerCase()) return json(res, 200, { error: 'no such stream' }); if (st.status !== 'paused') return json(res, 200, { error: 'stream is ' + st.status }); st.status = 'live'; st.next = Date.now(); runStreams(Date.now()); save(); return json(res, 200, { ok: true, ...account(d.wallet) }); }
    if (u === '/api/invoice/create') { // ask for sUSD as a link; payer stays unnamed
      const amt = +d.amount || 0; if (amt < 1) return json(res, 200, { error: 'minimum 1 sUSD' }); const id = base58(randomBytes(9));
      db.invoices[id] = { id, to: d.wallet.toLowerCase(), amt, memo: String(d.memo || '').slice(0, 80), ts: Date.now(), paid: false }; db.payroll.invoicedUsd += amt; save();
      return json(res, 200, { ok: true, id, ...account(d.wallet) });
    }
    if (u === '/api/invoice/pay') { // pay an invoice from cloaked balance
      const I = db.invoices[String(d.id || '')]; if (!I) return json(res, 200, { error: 'no such invoice' }); if (I.paid) return json(res, 200, { error: 'already paid' }); if (I.to === d.wallet.toLowerCase()) return json(res, 200, { error: 'this is your own invoice' });
      if (w.priv + 1e-9 < I.amt) return json(res, 200, { error: 'not enough cloaked balance' });
      const net = svc('send', I.amt, w); w.priv -= I.amt; const r = W(I.to); r.priv += net; sh.nullifiers++; const { C, note } = shieldNote(net, shKeys[randomInt(0, shKeys.length)].pub); pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('i', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() });
      const rc = receipt('invoice', net, I.id); I.paid = true; I.paidTs = Date.now(); I.receipt = rc.id; I.receiptSig = rc.sig; hist(w, { type: 'invoice', amt: I.amt, memo: I.memo, id: rc.id }); hist(r, { type: 'received', amt: net, memo: I.memo, id: rc.id }); db.payroll.invoicesPaid++; save();
      return json(res, 200, { ok: true, paid: I.amt, receipt: rc, ...account(d.wallet) });
    }
    if (u === '/api/receipt') { const rc = db.receipts[String(d.id || '')]; if (!rc) return json(res, 200, { error: 'no such receipt' }); const mine = (w.hist || []).some((h) => h.id === d.id); if (!mine) return json(res, 200, { error: 'not your receipt' }); return json(res, 200, { ok: true, id: d.id, sig: rc.sig, kind: rc.kind, amt: rc.amt, ts: rc.ts }); }
    if (u === '/api/carbon') {`, 'wallet routes');
fs.writeFileSync('server/index.js', s); console.log('payroll patched');
