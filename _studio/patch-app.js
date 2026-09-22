// one-shot: SEAL client wording + Streams / Invoices / Receipts tabs in client/src/app.js. Already applied; do not re-run.
const fs = require('fs'); let s = fs.readFileSync('client/src/app.js', 'utf8');
const rep = (a, b, t) => { if (!s.includes(a)) throw new Error('missing ' + t); s = s.split(a).join(b); };

// wording: cloak -> seal, drops -> envelopes stay as pay links, mirror -> ledger key
rep("'Sora'", "'Instrument Sans'", 'font');
rep("toast('vault opened')", "toast('desk opened')", 'opened');
rep('<b>Mirror.</b> This view key opens a read-only mirror', '<b>Ledger key.</b> This view key opens a read-only ledger', 'mirror');
rep('mirror ↗', 'ledger ↗', 'mirror2');
rep('<b>You have a drop waiting.</b> Cloaked sUSD is locked behind this link.', '<b>An envelope is waiting for you.</b> Sealed sUSD is locked behind this link.', 'claim');
rep('Claim into my cloaked balance', 'Open into my sealed balance', 'claimbtn');
rep('<b>Blind Desk.</b> Commit cloaked sUSD to a stock.', '<b>Blind Desk.</b> Commit sealed sUSD to a stock.', 'desk');
rep('stay cloaked. 30 bps each way to Erase.', 'stay sealed. 30 bps each way.', 'desk2');
rep('>Open cloaked<', '>Open sealed<', 'desk3'); rep(', cloaked`', ', sealed`', 'desk4');
rep('Send cloaked sUSD. The <b>amount and both parties never appear</b>', 'Send sealed sUSD. The <b>amount and both parties never appear</b>', 'send');
rep('>Send cloaked<', '>Send sealed<', 'send2');
rep('<b>Or leave a drop:</b> no address needed. Lock the amount above behind a link', '<b>Or seal an envelope:</b> no address needed. Lock the amount above behind a link', 'drop');
rep('>Create drop link<', '>Seal envelope<', 'drop2'); rep('`drop created with ${fmt(r.amt, 2)} sUSD. copy the link`', '`envelope sealed with ${fmt(r.amt, 2)} sUSD. copy the link`', 'drop3');
rep("Move public sUSD into the <b>shielded pool</b>. It becomes a note <b>encrypted only to you</b> — your balance is unreadable on-chain.", "Seal public sUSD. It becomes a note <b>encrypted only to you</b>. Your balance is unreadable on-chain.", 'shield');
rep('>Shield sUSD<', '>Seal sUSD<', 'shield2'); rep('`shielded ${fmt(r.shielded, 2)} sUSD`', '`sealed ${fmt(r.shielded, 2)} sUSD`', 'shield3');
rep('Your private balance', 'Sealed balance', 'privlabel');

// new tabs
rep(`  } else if (tab === 'dark') {`, `  } else if (tab === 'stream') {
    const P = M && M.payroll, mine = (A && A.streams) || [];
    p.innerHTML = \`<div class="note"><b>Streams.</b> Schedule sealed payments: X sUSD to one address, every period, N times. Each payment is a sealed send with a signed receipt. The recipient never appears on the ledger. 30 bps per payment.</div>
      <div class="field"><input id="to" placeholder="recipient Robinhood Chain address…" spellcheck="false"></div>
      <div class="field"><input id="label" placeholder="label, seen only by both of you (optional)" maxlength="40"></div>
      <div style="display:flex;gap:8px"><div class="field" style="flex:1.2"><input id="in" type="number" placeholder="amount per payment" min="1"><span class="u">sUSD</span></div>
      <div class="field" style="flex:.8"><input id="n" type="number" placeholder="payments" min="1" max="\${P ? P.maxN : 520}"><span class="u">×</span></div>
      <div class="field" style="flex:1"><select id="period">\${(P ? P.periods : ['day']).map((x) => '<option value="' + x + '"' + (x === 'month' ? ' selected' : '') + '>every ' + x + '</option>').join('')}</select></div></div>
      <div class="kv"><span>Sealed balance</span><b>\${A ? (reveal ? fmt(A.priv, 2) : '<span class="redact">0000</span>') : '—'}</b></div><div class="kv"><span>total committed</span><b id="o1">—</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Start stream</button>
      \${mine.length ? '<div style="margin-top:16px">' + mine.map((q) => \`<div class="pos"><b>\${q.label || 'stream'}</b><span>\${fmt(q.amt, 2)} sUSD · every \${q.period}</span><span class="sg">\${q.paid}/\${q.n} paid · \${q.status}\${q.status === 'live' ? ' · next ' + dur(Math.max(0, q.next - Date.now())) : ''}</span>\${q.status === 'live' ? '<button data-cancel="' + q.id + '">Cancel</button>' : q.status === 'paused' ? '<button data-resume="' + q.id + '">Resume</button>' : ''}</div>\`).join('') + '</div>' : ''}\`;
    const calc = () => { $('o1').textContent = fmt((+$('in').value || 0) * (+$('n').value || 0), 2) + ' sUSD over ' + (+$('n').value || 0) + ' payments'; }; $('in').oninput = calc; $('n').oninput = calc;
    $('act').onclick = () => doAct('/api/stream/create', { to: ($('to').value || '').trim(), amount: +$('in').value, n: +$('n').value, period: $('period').value, label: $('label').value }, (r) => \`stream started · \${fmt(r.stream.amt, 2)} sUSD every \${r.stream.period} × \${r.stream.n}\`);
    p.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => doAct('/api/stream/cancel', { id: b.dataset.cancel, amount: 1 }, () => 'stream cancelled'));
    p.querySelectorAll('[data-resume]').forEach((b) => b.onclick = () => doAct('/api/stream/resume', { id: b.dataset.resume, amount: 1 }, () => 'stream resumed'));
  } else if (tab === 'invoice') {
    const inv = (A && A.invoices) || [];
    p.innerHTML = \`<div class="note"><b>Invoices.</b> Ask for sUSD as a link. Whoever opens it pays from their sealed balance straight into yours. The payer is never named, and both of you get a signed receipt.</div>
      <div class="field"><input id="in" type="number" placeholder="amount" min="1"><span class="u">sUSD</span></div>
      <div class="field"><input id="memo" placeholder="what it is for (seen by the payer)" maxlength="80"></div>
      <button class="btn fill wide" id="act" style="margin-top:6px">Create invoice link</button>
      \${lastInvoice ? '<div class="linkbox"><code>' + lastInvoice + '</code><button id="cpi">Copy</button></div>' : ''}
      \${inv.length ? '<div style="margin-top:16px">' + inv.map((q) => \`<div class="pos"><b>\${fmt(q.amt, 2)} sUSD</b><span class="sg">\${q.memo || 'invoice'}</span><span class="pnl \${q.paid ? 'up' : ''}">\${q.paid ? 'paid · receipt ' + q.receipt : 'open'}</span>\${q.paid ? '' : '<button data-copy="' + q.id + '">Link</button>'}</div>\`).join('') + '</div>' : ''}\`;
    $('act').onclick = () => doAct('/api/invoice/create', { amount: +$('in').value, memo: $('memo').value }, (r) => { lastInvoice = location.origin + '/#pay=' + r.id; renderPanel(); return 'invoice created. copy the link'; });
    if ($('cpi')) $('cpi').onclick = () => { navigator.clipboard.writeText(lastInvoice); toast('invoice link copied'); };
    p.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(location.origin + '/#pay=' + b.dataset.copy); toast('invoice link copied'); });
  } else if (tab === 'pay') {
    p.innerHTML = \`<div class="note"><b>Someone sent you an invoice.</b> Pay it from your sealed balance. You will not be named anywhere.</div>
      <div class="kv"><span>amount</span><b id="iv-amt">…</b></div><div class="kv"><span>for</span><b id="iv-memo">—</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Pay sealed</button>\`;
    api('/api/invoice/peek', { id: payId }).then((r) => { if (r.error) { $('iv-amt').textContent = r.error; $('act').disabled = true; return; } $('iv-amt').textContent = r.paid ? 'already paid' : fmt(r.amt, 2) + ' sUSD'; $('iv-memo').textContent = r.memo || '—'; if (r.paid) $('act').disabled = true; });
    $('act').onclick = () => doAct('/api/invoice/pay', { id: payId, amount: 1 }, (r) => { history.replaceState(null, '', location.pathname); tab = 'receipts'; renderPanel(); return \`paid \${fmt(r.paid, 2)} sUSD · receipt \${r.receipt.id}\`; });
  } else if (tab === 'receipts') {
    const rs = ((A && A.hist) || []).filter((h) => h.id && /^(stream|invoice|received)$/.test(h.type)).slice(0, 12);
    p.innerHTML = \`<div class="note"><b>Sealed receipts.</b> Every stream payment and invoice carries a signed receipt: id, amount, time and a signature. No sender. No recipient. Hand one to anyone; they verify it at <b>/verify</b> without learning who paid.</div>
      \${rs.length ? rs.map((h) => \`<div class="pos"><b>\${h.type}</b><span class="sg">\${h.memo || ''}</span><span>\${fmt(h.amt, 2)} sUSD</span><button data-rc="\${h.id}">Get receipt</button></div>\`).join('') : '<div class="kv"><span>no receipts yet</span><b>—</b></div>'}
      <div id="rcout"></div>\`;
    p.querySelectorAll('[data-rc]').forEach((b) => b.onclick = async () => { const r = await api('/api/receipt', { wallet, id: b.dataset.rc }); if (r.error) return toast(r.error, true); const url = location.origin + '/verify#' + r.id + '.' + r.sig; $('rcout').innerHTML = '<div class="linkbox"><code>' + url + '</code><button id="cpr">Copy</button></div>'; $('cpr').onclick = () => { navigator.clipboard.writeText(url); toast('receipt link copied'); }; });
  } else if (tab === 'dark') {`, 'tabs');
rep(`let carbonKey = '', claimSecret = '', lastNote = null;`, `let carbonKey = '', claimSecret = '', lastNote = null, lastInvoice = null, payId = '';`, 'vars');
rep(`if (hm) { claimSecret = hm[1]; tab = 'claim'; setTimeout(() => $('demo').scrollIntoView(), 400); }`, `if (hm) { claimSecret = hm[1]; tab = 'claim'; setTimeout(() => $('demo').scrollIntoView(), 400); } const pm = /pay=([1-9A-HJ-NP-Za-km-z]+)/.exec(location.hash || ''); if (pm) { payId = pm[1]; tab = 'pay'; setTimeout(() => $('demo').scrollIntoView(), 400); }`, 'deeplink');
// account view needs hist for receipts tab: server account() does not include hist; fetch via /api/view is read-only. Add hist to account response instead (server patch below).
fs.writeFileSync('client/src/app.js', s);

let v = fs.readFileSync('server/index.js', 'utf8');
if (!v.includes('hist: (w.hist || []).slice(0, 40)')) { v = v.replace(`quietEarned: w.quietEarned || 0, streams:`, `quietEarned: w.quietEarned || 0, hist: (w.hist || []).slice(0, 40), streams:`); fs.writeFileSync('server/index.js', v); }
console.log('app patched');
