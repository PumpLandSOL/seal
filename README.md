# SEAL — private payroll on Robinhood Chain

**Pay people. Show no one.** sUSD is a sealed dollar. Stream salaries, send invoices and issue signed receipts; the ledger records no sender, recipient or amount. $SEAL is the share token.

Dependency-free Node. `npm start` (port 8218). Local dev with faucet: `node _studio/dev.js`.

Payroll: Streams (`/api/stream/create|cancel|resume`), Invoices (`/api/invoice/create|peek|pay`, link `/#pay=<id>`), Sealed Receipts (`/api/receipt`, public `/api/receipt/verify`, page `/verify#<id>.<sig>`). Plus the sealed-dollar base: USDG deposits verified on-chain, mint/redeem, seal/send, envelopes, ledger keys, Blind Desk, bonds + Cryo, the Window, Quiet Yield (40% of fees to sealed holders), burn, relays.

Env: `SEAL_MINT`, `TREASURY`, `ADMIN_KEY`, `DATA_PATH`, `QUIET_CUT`, `HAPPY_*`, `BOND_*`, `FREEZER_*`, `PUNCH_CUT`, `DARK_*`, `MIN_DEPOSIT`.

Tests: `_studio/e2e-*.cjs` on a fresh `DATA_PATH` each (payroll/quiet read `PORT`).
