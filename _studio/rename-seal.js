// one-shot: HUSH -> SEAL identifiers + defaults (already applied; don't re-run)
const fs = require('fs');
const files = ['server/index.js', 'client/src/app.js', 'client/view.html', '_studio/e2e-flow.cjs', '_studio/e2e-carbon.cjs', '_studio/e2e-quiet.cjs'];
const R = [[/HUSH_MINT/g, 'SEAL_MINT'], [/hushLive/g, 'sealLive'], [/HUSH_LIVE/g, 'SEAL_LIVE'], [/hushPrice/g, 'sealPrice'], [/HUSH/g, 'SEAL'], [/Hush/g, 'Seal'], [/hush/g, 'seal'], [/hUSD/g, 'sUSD'], [/husd/g, 'susd']];
for (const f of files) { let s = fs.readFileSync(f, 'utf8'); for (const [a, b] of R) s = s.replace(a, b); fs.writeFileSync(f, s); }
let s = fs.readFileSync('server/index.js', 'utf8');
s = s.replace(/const SEAL_MINT = .*\n/, "const SEAL_MINT = process.env.SEAL_MINT || '';   // $SEAL on Robinhood Chain — set at launch\n");
s = s.replace('|| 8212', '|| 8218');
fs.writeFileSync('server/index.js', s);
for (const f of ['_studio/e2e-flow.cjs', '_studio/e2e-carbon.cjs', '_studio/e2e-quiet.cjs']) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/localhost:8212/g, 'localhost:8218').replace(/\|\| 8212/g, '|| 8218'));
