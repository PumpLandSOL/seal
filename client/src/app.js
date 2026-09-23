'use strict';
const $ = (id) => document.getElementById(id);
const api = (u, b) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const fmt = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : (+n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const big = (n) => Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + 'M' : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + 'K' : fmt(n, 0);
const ago = (ts) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's ago' : Math.floor(s / 60) + 'm ago'; };
function toast(m, err) { const t = $('toast'); t.textContent = m; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 2400); }

let M = null, A = null, tab = 'mint', reveal = false;
const dur = (ms) => { const d = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4); return d > 0 ? d + 'd ' + hh + 'h' : hh + 'h ' + mm + 'm'; };
let wallet = localStorage.getItem('seal_w') || '';
let refParam = ''; try { const q = new URLSearchParams(location.search); if (/^0x[a-fA-F0-9]{40}$/.test(q.get('ref') || '')) { refParam = q.get('ref').toLowerCase(); localStorage.setItem('seal_ref', refParam); } else refParam = localStorage.getItem('seal_ref') || ''; } catch (e) {}

function setConnected() { const b = $('connect'); b.textContent = wallet ? wallet.slice(0, 4) + '…' + wallet.slice(-4) : 'Connect'; }
const CHAIN_HEX = '0x1237';
const evm = () => window.ethereum || null;
async function ensureChain(eth) { try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); } catch (e) { if (e && e.code === 4902) { try { await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'], blockExplorerUrls: ['https://explorer.mainnet.chain.robinhood.com'] }] }); } catch (e2) {} } } }
async function connectPhantom() {                                // EVM wallet on Robinhood Chain (name kept for the call sites)
  const eth = evm();
  if (!eth) { $('wmodal').classList.add('on'); return; }          // fallback: paste an address
  try {
    const acc = await eth.request({ method: 'eth_requestAccounts' });
    if (!acc || !acc.length) throw new Error('no account');
    await ensureChain(eth);
    const pk = acc[0].toLowerCase();
    wallet = pk; localStorage.setItem('seal_w', pk); setConnected(); toast('wallet connected · Robinhood Chain'); await loadAccount();
  } catch (e) { toast('connection cancelled', true); }
}
if (window.ethereum && window.ethereum.on) window.ethereum.on('accountsChanged', (acc) => { if (acc && acc.length) { wallet = acc[0].toLowerCase(); localStorage.setItem('seal_w', wallet); setConnected(); loadAccount(); } });
$('connect').onclick = async () => {
  if (wallet) {                                                   // already connected -> disconnect
    wallet = ''; localStorage.removeItem('seal_w'); A = null; setConnected(); renderAccount(); toast('disconnected'); return;
  }
  await connectPhantom();
};
$('wmodal').onclick = (e) => { if (e.target.id === 'wmodal') $('wmodal').classList.remove('on'); };
$('wsave').onclick = async () => { const v = $('waddr').value.trim(); if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return toast('invalid address', true); wallet = v.toLowerCase(); localStorage.setItem('seal_w', v); setConnected(); $('wmodal').classList.remove('on'); toast('desk opened'); await loadAccount(); };
function needWallet() { if (!wallet) { connectPhantom(); return true; } return false; }
$('cta-demo').onclick = () => $('demo').scrollIntoView({ behavior: 'smooth' });

// ---------- metrics ----------
async function loadMetrics() { M = await api('/api/metrics'); renderMetrics(); }
function renderMetrics() {
  if (!M) return;
  const pegEl = $('s-peg'); pegEl.textContent = '$' + fmt(M.susdPrice, 4); pegEl.className = 'v peg ' + M.pegStatus;
  $('s-cr').textContent = fmt(M.cr * 100, 1) + '%';
  $('s-col').textContent = '$' + big(M.collateralUsd);
  $('s-sup').textContent = big(M.susdSupply) + ' sUSD';
  $('s-shd').textContent = big(M.shielded.totalValue) + ' sUSD';
  if (M.mint) { $('cabar').style.display = 'flex'; $('ca-mint').textContent = M.mint; }
  
  if (M.dark) { const D = M.dark;
    $('tape').innerHTML = D.markets.map((m) => `<div class="m ${m.fresh ? '' : 'closed'}"><div class="s">${m.sym}</div><div class="p">${m.px ? '$' + fmt(m.px, m.px < 10 ? 4 : 2) : '—'}</div><div class="st">${m.fresh ? 'live' : 'closed'}</div></div>`).join('');
    $('dk-open').textContent = fmt(D.open, 0); $('dk-vol').textContent = '$' + big(D.volume); $('dk-fees').textContent = '$' + fmt(D.fees, 2);
  }
  if (M.bonds) { const Bd = M.bonds;
    $('bd-price').textContent = '$' + fmt(Bd.price, 6); $('bd-market').textContent = '$' + fmt(Bd.market, 6); $('bd-left').textContent = '$' + fmt(Bd.leftToday, 0) + ' / $' + fmt(Bd.capUsd, 0); $('bd-sold').textContent = '$' + fmt(Bd.soldUsd, 0) + ' · ' + big(Bd.soldSeal) + ' SEAL'; if (Bd.freezer) { $('fg-price').textContent = '$' + fmt(Bd.freezer.price, 6) + ' (−' + fmt(Bd.freezer.discount * 100, 0) + '%)'; $('fg-locked').textContent = big(Bd.freezer.lockedSeal) + ' SEAL · ' + Bd.freezer.n + ' in cryo'; }
  }
  if (M.happy) { const V = M.happy;
    $('v-apy').textContent = fmt(V.apy * 100, 0) + '%'; $('v-boost').textContent = V.boost && V.boost.live ? '⚡ boosted from ' + fmt(V.baseApy * 100, 0) + '% · ' + dur(V.boost.endsIn) + ' left' : ''; $('v-staked').textContent = big(V.staked) + ' / ' + big(V.cap);
    $('v-pool').textContent = big(V.poolLeft) + ' SEAL'; $('v-ends').textContent = V.startsIn > 0 ? 'opens in ' + dur(V.startsIn) : V.live ? dur(V.endsIn) : 'ended'; $('v-n').textContent = fmt(V.stakers, 0);
  }
  
  if (M.punch) { const Fm = M.punch;
    $('punchboard').innerHTML = Fm.board.map((b, i) => `<div class="r"><span class="ty">#${i + 1}</span><span class="sg">${b.who}</span><span class="am">${b.guests} referred · ${fmt(b.earned, 2)} sUSD</span></div>`).join('') || '<div class="r"><span class="sg">no relays yet. send the first drop</span></div>';
  }
  if (M.quiet) { const Q = M.quiet;
    $('q-cut').textContent = fmt(Q.cut * 100, 0) + '%'; $('q-paid').textContent = fmt(Q.paid, 2) + ' sUSD'; $('q-24h').textContent = fmt(Q.paid24h, 2) + ' sUSD'; $('q-apr').textContent = Q.cloaked > 0 && Q.paid24h > 0 ? fmt(Q.apr * 100, 1) + '%' : '—'; $('q-n').textContent = fmt(Q.payouts, 0); $('q-holders').textContent = fmt(Q.holders, 0);
  }
  if (M.shred) { const P = M.shred;
    $('p-seal').textContent = big(P.burnedSeal) + ' SEAL'; $('p-usd').textContent = '$' + big(P.burnedUsd);
    $('p-svc').textContent = '$' + fmt(P.svcUsd, 2) + ' / $' + P.minUsd; $('p-ep').textContent = fmt(P.epochs, 0);
    $('shredfeed').innerHTML = P.burns.map((b) => `<div class="r"><span class="ty burn">erase</span><span class="sg">epoch ${b.epoch} · ${b.id} · @ $${fmt(b.px, 6)}</span><span class="am">− ${fmt(b.seal, 1)} SEAL</span></div>`).join('') || '<div class="r"><span class="sg">waiting on the first fees to erase…</span></div>';
  }
  $('feed').innerHTML = (M.feed.length ? M.feed : []).map((t) => {
    const right = t.type === 'private' ? '<span class="redact">█████</span>'
      : t.publicAmount != null ? fmt(t.publicAmount, 0) + ' sUSD' : '<span class="redact">████</span>';
    const ty = t.type === 'private' ? 'private' : t.type;
    return `<div class="r"><span class="ty ${t.type}">${ty}</span><span class="sg">${t.sig}</span><span class="am">${right}</span></div>`;
  }).join('') || '<div class="r"><span class="sg">no signal yet</span></div>';
}

// ---------- account ----------
async function loadAccount() { if (!wallet) { A = null; renderAccount(); return; } A = await api('/api/account', { wallet, ref: refParam || undefined }); if (A.error) { toast(A.error, true); A = null; } renderAccount(); }
function renderAccount() {
  if (wallet) { $('punchbox').style.display = 'flex'; $('punchlink').textContent = location.origin + '/?ref=' + wallet; } else $('punchbox').style.display = 'none';
  $('f-guests').textContent = A ? fmt(A.guests, 0) : '—'; $('f-earned').textContent = A ? fmt(A.earned, 2) + ' sUSD' : '—';
  $('q-me').textContent = A ? '+' + fmt(A.quietEarned || 0, 4) + ' sUSD' : '—'; $('q-me2').textContent = A ? '+' + fmt(A.quietEarned || 0, 4) + ' sUSD' : '—';
  $('b-usdg').textContent = A ? fmt(A.usdg, 0) : '—';
  $('b-seal').textContent = A ? fmt(A.seal, 1) : '—';
  $('b-susd').textContent = A ? fmt(A.susd, 2) : '—';
  renderPriv();
  renderPanel();
}
function renderPriv() {
  const red = $('b-priv-red'), val = $('b-priv-val');
  if (reveal && A) { red.style.display = 'none'; val.style.display = ''; val.textContent = fmt(A.priv, 2); $('b-priv-eye').textContent = 'hide'; }
  else { red.style.display = ''; val.style.display = 'none'; $('b-priv-eye').textContent = 'reveal'; }
}
$('b-priv-eye').onclick = () => { reveal = !reveal; renderPriv(); };
$('b-carbon').onclick = async () => { if (needWallet()) return; const r = await api('/api/carbon', { wallet }); if (r.error) return toast(r.error, true); tab = 'seal'; carbonKey = r.viewKey; document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('on')); renderPanel(); $('demo').scrollIntoView({ behavior: 'smooth' }); };
let carbonKey = '', claimSecret = '', lastNote = null, lastInvoice = null, payId = '';

// ---------- demo tabs ----------
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderPanel(); });
function renderPanel() {
  const p = $('panel'); const cr = M ? M.cr : 0.9, vp = M ? M.sealPrice : 0.85;
  if (tab === 'seal') {
    const url = location.origin + '/view#' + carbonKey;
    p.innerHTML = `<div class="note"><b>Ledger key.</b> This view key opens a read-only ledger of your shielded balance and history. It <b>cannot spend</b>. Give it only to who you want to see.</div>
      <div class="linkbox"><code id="vk">${url}</code><button id="cp">Copy</button></div>
      <div class="kv" style="margin-top:12px"><span>opens</span><b><a href="${url}" target="_blank" style="color:var(--gold)">ledger ↗</a></b></div>`;
    $('cp').onclick = () => { navigator.clipboard.writeText(url); toast('view key copied'); };
  } else if (tab === 'claim') {
    p.innerHTML = `<div class="note"><b>An envelope is waiting for you.</b> Sealed sUSD is locked behind this link. Claim it into your shielded balance.</div>
      <div class="kv"><span>amount</span><b id="cl-amt">…</b></div><div class="kv"><span>memo</span><b id="cl-memo">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Open into my sealed balance</button>`;
    api('/api/note/peek', { secret: claimSecret }).then((r) => { if (r.error) { $('cl-amt').textContent = r.error; $('act').disabled = true; return; } $('cl-amt').textContent = r.claimed ? 'already claimed' : fmt(r.amt, 2) + ' sUSD'; $('cl-memo').textContent = r.memo || '—'; if (r.claimed) $('act').disabled = true; });
    $('act').onclick = () => doAct('/api/note/claim', { secret: claimSecret, amount: 1 }, (r) => { history.replaceState(null, '', location.pathname); tab = 'send'; renderPanel(); return `claimed ${fmt(r.claimed, 2)} sUSD, sealed`; });
  } else if (tab === 'stream') {
    const P = M && M.payroll, mine = (A && A.streams) || [];
    p.innerHTML = `<div class="note"><b>Streams.</b> Schedule sealed payments: X sUSD to one address, every period, N times. Each payment is a sealed send with a signed receipt. The recipient never appears on the ledger. 30 bps per payment.</div>
      <div class="field"><input id="to" placeholder="recipient Robinhood Chain address…" spellcheck="false"></div>
      <div class="field"><input id="label" placeholder="label, seen only by both of you (optional)" maxlength="40"></div>
      <div style="display:flex;gap:8px"><div class="field" style="flex:1"><input id="in" type="number" placeholder="amount" min="1"><span class="u">sUSD</span></div>
      <div class="field" style="flex:.7"><input id="n" type="number" placeholder="count" min="1" max="${P ? P.maxN : 520}"></div></div>
      <div class="field"><select id="period">${(P ? P.periods : ['day']).map((x) => '<option value="' + x + '"' + (x === 'month' ? ' selected' : '') + '>every ' + x + '</option>').join('')}</select></div></div>
      <div class="kv"><span>Sealed balance</span><b>${A ? (reveal ? fmt(A.priv, 2) : '<span class="redact">0000</span>') : '—'}</b></div><div class="kv"><span>total committed</span><b id="o1">—</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Start stream</button>
      ${mine.length ? '<div style="margin-top:16px">' + mine.map((q) => `<div class="pos"><b>${q.label || 'stream'}</b><span>${fmt(q.amt, 2)} sUSD · every ${q.period}</span><span class="sg">${q.paid}/${q.n} paid · ${q.status}${q.status === 'live' ? ' · next ' + dur(Math.max(0, q.next - Date.now())) : ''}</span>${q.status === 'live' ? '<button data-cancel="' + q.id + '">Cancel</button>' : q.status === 'paused' ? '<button data-resume="' + q.id + '">Resume</button>' : ''}</div>`).join('') + '</div>' : ''}`;
    const calc = () => { $('o1').textContent = fmt((+$('in').value || 0) * (+$('n').value || 0), 2) + ' sUSD over ' + (+$('n').value || 0) + ' payments'; }; $('in').oninput = calc; $('n').oninput = calc;
    $('act').onclick = () => doAct('/api/stream/create', { to: ($('to').value || '').trim(), amount: +$('in').value, n: +$('n').value, period: $('period').value, label: $('label').value }, (r) => `stream started · ${fmt(r.stream.amt, 2)} sUSD every ${r.stream.period} × ${r.stream.n}`);
    p.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => doAct('/api/stream/cancel', { id: b.dataset.cancel, amount: 1 }, () => 'stream cancelled'));
    p.querySelectorAll('[data-resume]').forEach((b) => b.onclick = () => doAct('/api/stream/resume', { id: b.dataset.resume, amount: 1 }, () => 'stream resumed'));
  } else if (tab === 'invoice') {
    const inv = (A && A.invoices) || [];
    p.innerHTML = `<div class="note"><b>Invoices.</b> Ask for sUSD as a link. Whoever opens it pays from their sealed balance straight into yours. The payer is never named, and both of you get a signed receipt.</div>
      <div class="field"><input id="in" type="number" placeholder="amount" min="1"><span class="u">sUSD</span></div>
      <div class="field"><input id="memo" placeholder="what it is for (seen by the payer)" maxlength="80"></div>
      <button class="btn fill wide" id="act" style="margin-top:6px">Create invoice link</button>
      ${lastInvoice ? '<div class="linkbox"><code>' + lastInvoice + '</code><button id="cpi">Copy</button></div>' : ''}
      ${inv.length ? '<div style="margin-top:16px">' + inv.map((q) => `<div class="pos"><b>${fmt(q.amt, 2)} sUSD</b><span class="sg">${q.memo || 'invoice'}</span><span class="pnl ${q.paid ? 'up' : ''}">${q.paid ? 'paid · receipt ' + q.receipt : 'open'}</span>${q.paid ? '' : '<button data-copy="' + q.id + '">Link</button>'}</div>`).join('') + '</div>' : ''}`;
    $('act').onclick = () => doAct('/api/invoice/create', { amount: +$('in').value, memo: $('memo').value }, (r) => { lastInvoice = location.origin + '/#pay=' + r.id; renderPanel(); return 'invoice created. copy the link'; });
    if ($('cpi')) $('cpi').onclick = () => { navigator.clipboard.writeText(lastInvoice); toast('invoice link copied'); };
    p.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(location.origin + '/#pay=' + b.dataset.copy); toast('invoice link copied'); });
  } else if (tab === 'pay') {
    p.innerHTML = `<div class="note"><b>Someone sent you an invoice.</b> Pay it from your sealed balance. You will not be named anywhere.</div>
      <div class="kv"><span>amount</span><b id="iv-amt">…</b></div><div class="kv"><span>for</span><b id="iv-memo">—</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Pay sealed</button>`;
    api('/api/invoice/peek', { id: payId }).then((r) => { if (r.error) { $('iv-amt').textContent = r.error; $('act').disabled = true; return; } $('iv-amt').textContent = r.paid ? 'already paid' : fmt(r.amt, 2) + ' sUSD'; $('iv-memo').textContent = r.memo || '—'; if (r.paid) $('act').disabled = true; });
    $('act').onclick = () => doAct('/api/invoice/pay', { id: payId, amount: 1 }, (r) => { history.replaceState(null, '', location.pathname); tab = 'receipts'; renderPanel(); return `paid ${fmt(r.paid, 2)} sUSD · receipt ${r.receipt.id}`; });
  } else if (tab === 'receipts') {
    const rs = ((A && A.hist) || []).filter((h) => h.id && /^(stream|invoice|received)$/.test(h.type)).slice(0, 12);
    p.innerHTML = `<div class="note"><b>Sealed receipts.</b> Every stream payment and invoice carries a signed receipt: id, amount, time and a signature. No sender. No recipient. Hand one to anyone; they verify it at <b>/verify</b> without learning who paid.</div>
      ${rs.length ? rs.map((h) => `<div class="pos"><b>${h.type}</b><span class="sg">${h.memo || ''}</span><span>${fmt(h.amt, 2)} sUSD</span><button data-rc="${h.id}">Get receipt</button></div>`).join('') : '<div class="kv"><span>no receipts yet</span><b>—</b></div>'}
      <div id="rcout"></div>`;
    p.querySelectorAll('[data-rc]').forEach((b) => b.onclick = async () => { const r = await api('/api/receipt', { wallet, id: b.dataset.rc }); if (r.error) return toast(r.error, true); const url = location.origin + '/verify#' + r.id + '.' + r.sig; $('rcout').innerHTML = '<div class="linkbox"><code>' + url + '</code><button id="cpr">Copy</button></div>'; $('cpr').onclick = () => { navigator.clipboard.writeText(url); toast('receipt link copied'); }; });
  } else if (tab === 'dark') {
    const D = M && M.dark, pos = (A && A.dark) || [];
    p.innerHTML = `<div class="note"><b>Blind Desk.</b> Commit sealed sUSD to a stock. Long or short, 1x, live tape. Ticker, size and P&amp;L stay sealed. 30 bps each way.</div>
      <div style="display:flex;gap:10px"><div class="field" style="flex:1"><select id="sym" style="flex:1;background:none;border:none;color:var(--ink);font-family:'Instrument Sans';font-size:15px;outline:none">${(D ? D.markets : []).map((m) => `<option value="${m.sym}" ${m.fresh ? '' : 'disabled'}>${m.sym} ${m.px ? '· $' + fmt(m.px, 2) : ''}${m.fresh ? '' : ' · closed'}</option>`).join('')}</select></div>
      <div class="field" style="flex:0 0 150px"><select id="side" style="flex:1;background:none;border:none;color:var(--ink);font-family:'Instrument Sans';font-size:15px;outline:none"><option value="long">LONG</option><option value="short">SHORT</option></select></div></div>
      <div class="field"><input id="in" type="number" placeholder="10.00 minimum" min="10"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Shielded balance</span><b>${A ? (reveal ? fmt(A.priv, 2) : '<span class="redact">0000</span>') : '—'}</b></div><div class="kv"><span>Per position · pool</span><b>${D ? 'max ' + fmt(D.maxPos, 0) + ' · ' + (D.full ? 'full' : 'open') : '—'}</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Open sealed</button>
      ${pos.length ? '<div style="margin-top:16px">' + pos.map((q) => `<div class="pos"><b>${q.sym}</b><span>${q.side}</span><span class="sg" style="font-family:'Instrument Sans';font-size:12px;color:var(--mut)">${fmt(q.notional, 2)} @ ${fmt(q.entry, 2)} → ${fmt(q.px, 2)}</span><span class="pnl ${q.pnl >= 0 ? 'up' : 'dn'}">${q.pnl >= 0 ? '+' : ''}${fmt(q.pnl, 2)}</span><button data-close="${q.id}" ${q.fresh ? '' : 'disabled'}>Close</button></div>`).join('') + '</div>' : ''}`;
    $('mx').onclick = () => { if (A) $('in').value = Math.min(A.priv, D ? D.maxPos : 1000); };
    $('act').onclick = () => doAct('/api/dark/open', { sym: $('sym').value, side: $('side').value, amount: +$('in').value }, (r) => `opened ${r.opened.side} ${r.opened.sym} , sealed`);
    p.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => doAct('/api/dark/close', { id: b.dataset.close, amount: 1 }, (r) => `closed · ${r.closed.pnl >= 0 ? '+' : ''}${fmt(r.closed.pnl, 2)} sUSD`));
  } else if (tab === 'bond') {
    const Bd = M && M.bonds, me = A && A.bonds;
    const F = Bd && Bd.freezer; if (typeof window.__lock === 'undefined') window.__lock = true; const L = window.__lock;
    p.innerHTML = `<div class="note"><b>Bond USDG for $SEAL at ${Bd ? fmt(Bd.discount * 100, 0) : 20}% below market.</b> Vests over ${Bd ? Bd.vestDays : 5} days. Your USDG goes to the reserve and mints nothing. ${Bd && !Bd.open ? '<b>Bonds are closed.</b>' : ''}</div>
      <div style="display:flex;gap:8px;margin:0 0 12px"><button class="btn ${L ? 'fill' : 'ghost'}" id="lk1" style="flex:1.3">CRYO · lock ${F ? F.lockDays * 24 : 48}h · −${F ? fmt(F.discount * 100, 0) : 30}% · ${F ? fmt(F.apy * 100, 0) : 80}% APY</button><button class="btn ${L ? 'ghost' : 'fill'}" id="lk0" style="flex:1">Standard bond · −${Bd ? fmt(Bd.discount * 100, 0) : 20}% · ${Bd ? Bd.vestDays : 5}d vest</button></div>
      ${L ? `<div class="note" style="border-color:var(--gold)"><b>Cryo:</b> your USDG enters the bond pool, you take $SEAL at <b>${F ? fmt(F.discount * 100, 0) : 30}% below market</b>, locked <b>${F ? F.lockDays * 24 : 48} hours</b>. While locked it earns <b>${F ? fmt(F.apy * 100, 0) : 80}% APY in $SEAL</b>, paid from the Window's fixed pool. Nothing printed. Claim principal + yield at unlock.</div>` : ''}
      <div class="field"><input id="in" type="number" placeholder="50.00 minimum" min="50"><span class="u">USDG</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>USDG on ledger</span><b>${A ? fmt(A.usdg, 2) : '—'}</b></div>
      <div class="kv"><span>${L ? 'cryo' : 'bond'} price · market</span><b>${Bd ? '$' + fmt(L && F ? F.price : Bd.price, 6) + ' · $' + fmt(Bd.market, 6) : '—'}</b></div>
      <div class="kv"><span>you receive</span><b id="o1">—</b></div>
      ${L ? '<div class="kv"><span>yield at unlock</span><b id="o2">—</b></div>' : ''}
      <div class="kv"><span>vesting · claimable now</span><b>${me ? big(me.pending) + ' · ' + big(me.claimable) + ' SEAL' : '—'}</b></div>
      ${me && me.locked ? `<div class="kv"><span>in cryo · yield building</span><b style="color:var(--gold2)">${big(me.locked)} · +${big(me.freezing)} SEAL</b></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn fill" id="act" style="flex:1.4">${L ? 'Cryo-lock SEAL' : 'Bond USDG'}</button><button class="btn ghost" id="act2" style="flex:1">Claim vested</button><button class="btn ghost" id="act3" style="flex:1">Withdraw SEAL</button></div>
      <div class="note" style="margin-top:12px;margin-bottom:0">No USDG yet? <a href="#" id="go-dep" style="color:var(--gold)">Deposit first →</a></div>`;
    $('mx').onclick = () => { if (A) $('in').value = A.usdg; };
    $('in').oninput = () => { const x = +$('in').value || 0; const px = L && F ? F.price : (Bd && Bd.price); $('o1').textContent = Bd ? big(x / px) + ' SEAL (' + big(x / Bd.market) + ' at market)' : '—'; if (L && F && $('o2')) $('o2').textContent = '+' + big(x / px * F.apy * F.lockDays / 365) + ' SEAL (' + fmt(F.apy * 100, 0) + '% APY × ' + F.lockDays * 24 + 'h)'; };
    $('lk1').onclick = () => { window.__lock = true; renderPanel(); }; $('lk0').onclick = () => { window.__lock = false; renderPanel(); };
    $('act').onclick = () => doAct('/api/bond', { amount: +$('in').value, lock: L }, (r) => r.lock ? `cryo-locked ${fmt(r.bonded, 2)} USDG → ${big(r.sealOut)} SEAL locked ${F.lockDays * 24}h at ${fmt(r.apy * 100, 0)}% APY` : `bonded ${fmt(r.bonded, 2)} USDG → ${big(r.sealOut)} SEAL vesting`);
    $('act2').onclick = () => doAct('/api/bond/claim', { amount: 1 }, (r) => `claimed ${big(r.claimedSeal)} SEAL${r.frozenSeal > 0 ? ' (incl. ' + big(r.frozenSeal) + ' cryo yield)' : ''}`);
    $('act3').onclick = () => doAct('/api/withdraw', { asset: 'SEAL', amount: A ? A.seal : 0 }, (r) => `queued ${big(r.queued.amt)} SEAL for payout`);
    $('go-dep').onclick = (e) => { e.preventDefault(); tab = 'deposit'; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'deposit')); renderPanel(); };
  } else if (tab === 'deposit') {
    p.innerHTML = `<div class="note">Send <b>USDG on Robinhood Chain</b> to the treasury and it is credited to your ledger once the receipt confirms. <b>Every deposited dollar sits in the treasury address</b> — check it on the explorer any time.</div>
      <div class="field"><input id="in" type="number" placeholder="50.00 minimum" min="50"><span class="u">USDG</span></div>
      <div class="kv"><span>Treasury</span><b>${M && M.treasury ? M.treasury.slice(0, 8) + '…' + M.treasury.slice(-6) : '—'}</b></div>
      <div class="kv"><span>Credited so far</span><b>${A ? fmt(A.deposited, 2) + ' USDG' : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Send USDG from wallet</button>
      <div class="note" style="margin-top:14px;margin-bottom:8px">Already sent? Paste the transaction hash:</div>
      <div class="field"><input id="tx" placeholder="0x… transaction hash" spellcheck="false"></div>
      <button class="btn ghost wide" id="act2">Credit my deposit</button>`;
    $('act').onclick = () => sendUsdg(+$('in').value);
    $('act2').onclick = () => doAct('/api/deposit', { tx: ($('tx').value || '').trim(), amount: 1 }, (r) => `credited ${fmt(r.amt, 2)} USDG from the treasury deposit`);
  } else if (tab === 'happy') {
    const V = M && M.happy, me = A && A.happy;
    p.innerHTML = `<div class="note">Stake public sUSD in <b>the Window</b>: <b>${V ? fmt(V.apy * 100, 0) : '—'}% APY</b> for 30 days, paid in <b>$SEAL</b> from a pre-funded pool. Unstake any time (30 bps fee). ${V && !V.live ? '<b>The Window is ' + (V.startsIn > 0 ? 'not open yet' : 'over') + '.</b>' : ''}</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div class="kv"><span>Staked</span><b>${me ? fmt(me.staked, 2) + ' sUSD' : '—'}</b></div>
      <div class="kv"><span>Earned · claimable</span><b>${me ? fmt(me.accruedSeal, 1) + ' SEAL (≈ $' + fmt(me.accruedUsd, 4) + ')' : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="act" style="flex:1">Stake</button><button class="btn ghost" id="act2" style="flex:1">Unstake</button><button class="btn ghost" id="act3" style="flex:1">Claim SEAL</button></div>`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/stake', { amount: +$('in').value }, (r) => `${fmt(r.staked, 2)} sUSD staked`);
    $('act2').onclick = () => doAct('/api/unstake', { amount: +$('in').value }, (r) => `unstaked ${fmt(r.unstaked, 2)} sUSD`);
    $('act3').onclick = () => doAct('/api/claim', { amount: 1 }, (r) => `claimed ${fmt(r.claimedSeal, 1)} SEAL`);
  } else if (tab === 'mint') {
    p.innerHTML = `<div class="note">Mint $1-pegged <b>sUSD</b> with deposited USDG: <b>${fmt(cr * 100, 0)}% goes to collateral</b>, the <b>${fmt((1 - cr) * 100, 0)}% algorithmic share buys SEAL at market and burns it</b>. Nothing is printed.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span></div>
      <div class="kv"><span>USDG collateral (${fmt(cr * 100, 0)}%)</span><b id="o1">—</b></div><div class="kv"><span>USDG → buys &amp; burns SEAL (${fmt((1 - cr) * 100, 0)}%)</span><b id="o2">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Mint sUSD</button>`;
    $('in').oninput = () => { const m = +$('in').value || 0; $('o1').textContent = fmt(m * cr, 2) + ' USDG'; $('o2').textContent = fmt(m * (1 - cr), 2) + ' USDG ≈ ' + fmt((m * (1 - cr)) / vp, 0) + ' SEAL'; };
    $('act').onclick = () => doAct('/api/mint', { amount: +$('in').value }, (r) => `minted ${fmt(r.minted, 0)} sUSD`);
  } else if (tab === 'shield') {
    p.innerHTML = `<div class="note">Seal public sUSD. It becomes a note <b>encrypted only to you</b>. Your balance is unreadable on-chain.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD available</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Seal sUSD</button>`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/shield', { amount: +$('in').value }, (r) => `sealed ${fmt(r.shielded, 2)} sUSD`);
  } else if (tab === 'send') {
    p.innerHTML = `<div class="note">Send sealed sUSD. The <b>amount and both parties never appear</b> — the ledger records only a nullifier + a new commitment.</div>
      <div class="field"><input id="to" placeholder="recipient Robinhood Chain address…" spellcheck="false"></div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Sealed balance</span><b>${A ? (reveal ? fmt(A.priv, 2) : '<span class="redact">0000</span>') : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Send sealed</button>
      <div class="note" style="margin:18px 0 8px"><b>Or seal an envelope:</b> no address needed. Lock the amount above behind a link and send the link to anyone.</div>
      <div class="field"><input id="memo" placeholder="memo (optional, seen only by the claimer)" maxlength="80"></div>
      <button class="btn ghost wide" id="act2">Seal envelope</button>
      ${lastNote ? '<div class="linkbox"><code>' + lastNote + '</code><button id="cpn">Copy</button></div>' : ''}`;
    $('mx').onclick = () => { if (A) $('in').value = A.priv; };
    $('act').onclick = () => doAct('/api/send', { to: ($('to').value || '').trim(), amount: +$('in').value }, (r) => `sent ${fmt(r.sent, 2)} sUSD, sealed`);
    $('act2').onclick = () => doAct('/api/note/create', { amount: +$('in').value, memo: $('memo').value }, (r) => { lastNote = location.origin + '/#claim=' + r.secret; renderPanel(); return `envelope sealed with ${fmt(r.amt, 2)} sUSD. copy the link`; });
    if ($('cpn')) $('cpn').onclick = () => { navigator.clipboard.writeText(lastNote); toast('link copied'); };
  } else {
    p.innerHTML = `<div class="note">Burn sUSD to recover your <b>${fmt(cr * 100, 0)}% USDG</b> plus the <b>${fmt((1 - cr) * 100, 0)}% SEAL</b> share. (Unshield private sUSD first to redeem it.)</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div class="kv"><span>USDG on ledger</span><b>${A ? fmt(A.usdg, 2) : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="act2" style="flex:1">Unshield</button><button class="btn" id="act" style="flex:1">Redeem</button><button class="btn ghost" id="act3" style="flex:1">Withdraw USDG</button></div>
      ${A && A.queue && A.queue.length ? '<div class="note" style="margin-top:14px">' + A.queue.map((q) => '<div class="kv"><span>withdraw ' + fmt(q.amt, 2) + ' ' + (q.asset || 'USDG') + ' · ' + q.id + '</span><b>' + (q.status === 'paid' ? 'paid' + (q.tx ? ' · ' + q.tx.slice(0, 10) + '…' : '') : 'queued · treasury pays within 24h') + '</b></div>').join('') + '</div>' : ''}`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/redeem', { amount: +$('in').value }, (r) => `redeemed ${fmt(r.redeemed, 0)} sUSD`);
    $('act2').onclick = () => doAct('/api/unshield', { amount: +$('in').value }, (r) => `unshielded ${fmt(r.unshielded, 2)} sUSD`);
    $('act3').onclick = () => doAct('/api/withdraw', { amount: +$('in').value }, (r) => `queued ${fmt(r.queued.amt, 2)} USDG for payout`);
  }
}
async function sendUsdg(amount) {
  if (needWallet()) return; if (!amount || amount <= 0) return toast('enter an amount', true); const minDep = (M && M.minDeposit) || 50; if (amount < minDep) return toast('minimum deposit is ' + minDep + ' USDG', true);
  const eth = evm(); if (!eth) return toast('open a wallet to send USDG, or paste a tx hash', true);
  if (!M || !M.chain || !M.chain.usdg || !M.treasury) return toast('treasury not configured', true);
  try {
    await ensureChain(eth);
    const units = BigInt(Math.round(amount * 1e6)).toString(16).padStart(64, '0');
    const data = '0xa9059cbb' + M.treasury.slice(2).toLowerCase().padStart(64, '0') + units;
    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: M.chain.usdg, data }] });
    toast('sent · waiting for the receipt…');
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 3000)); const r = await api('/api/deposit', { wallet, tx }); if (r.ok) { A = r; renderAccount(); loadMetrics(); return toast(`credited ${fmt(r.amt, 2)} USDG`); } if (r.error && !/pending|not found/.test(r.error)) return toast(r.error, true); }
    toast('still pending — paste the hash to credit later', true);
  } catch (e) { toast('transaction cancelled', true); }
}
async function doAct(url, payload, msg) {
  if (needWallet()) return;
  if (!payload.amount) return toast('enter an amount', true);
  const r = await api(url, Object.assign({ wallet }, payload));
  if (r.error) return toast(r.error, true);
  A = r; renderAccount(); loadMetrics(); toast(msg(r));
}
$('punchcopy').onclick = () => { navigator.clipboard.writeText(location.origin + '/?ref=' + wallet); toast('referral link copied'); };
$('ca-copy').onclick = () => { navigator.clipboard.writeText(M.mint); toast('copied'); };


// deep-link / capture: ?w=<address> opens a wallet's ledger, &tab=<mint|shield|send|redeem>, &reveal=1
(function () { const q = new URLSearchParams(location.search); const hm = /claim=([1-9A-HJ-NP-Za-km-z]+)/.exec(location.hash || ''); if (hm) { claimSecret = hm[1]; tab = 'claim'; setTimeout(() => $('demo').scrollIntoView(), 400); } const pm = /pay=([1-9A-HJ-NP-Za-km-z]+)/.exec(location.hash || ''); if (pm) { payId = pm[1]; tab = 'pay'; setTimeout(() => $('demo').scrollIntoView(), 400); }
  if (q.get('w')) wallet = q.get('w');
  if (q.get('tab')) tab = q.get('tab');
  if (q.get('reveal') === '1') reveal = true; })();

document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));

(async function () { await api('/api/config'); setConnected(); await loadMetrics(); await loadAccount(); renderPanel(); setInterval(loadMetrics, 5000); })();
