# FROST progress

## Done

- Phase 0. `docs/copilot/AUDIT.md`. This PC is CPU-only, about 6.7 GB RAM free, Ollama is not installed. Copilot port is 8787 because 8765 is the cart bridge. The service is TypeScript so it can call the existing Arrhenius code.
- Phase 1. Sidecar on `127.0.0.1:8787` with SQLite. Health without the token returns 401. Health with the token returned engine `rules`, `ollama: false`, `model: null`, `degraded: false`. The Next routes answer from the rules engine when the sidecar is down.
- Phase 2. Insights, slope forecast, excursion / flatline / jump / tamper detectors, and labelled simulator rows that never enter the fleet store.
- Phase 3. Fast-path answers, grounding check, keyword SOP search, memory and audit. 62 golden questions passed their include and exclude checks.
- Phase 4. The map panel shows one suggested move and the rupee cards. Confirm calls `applyHubHold`, `applyKitchenDivert`, or `markSellNow` with the hub on the card. The heuristic list still runs, on the probe temperature.
- Phase 5. What-if and `/report` (markdown and csv). Voice, desktop notifications, and a vector store were not built.

## Recheck

- `npx tsc --noEmit` passed.
- `npm test`: 23 files, 211 tests, passed twice (08:11:30 and 08:13:54 local).
- `node eval/run.mjs`: copilot and store tests, exit 0. See `eval/REPORT.md`.
- Sidecar chat on the fixture: Tomato SHP-1 at 24.6°C (probe), about 95.5 h of life, 0.4 h to drive, quality 100%, mode `rules`, verified. Re-anchor recorded as not anchored and not applied. Action `shell` returned 400.

## Decisions

- Rules output is labelled `FROST · rules`. Degraded mode is only after a model call fails.
- `update_threshold` is a log line. `produce.ts` stays as it is.
- Search is keyword overlap over four templates in `lib/copilot/knowledge.ts` and `docs/sop/`.
- Forecast is a last-step slope. It beats a naive last-value baseline on a straight series. Holt-Winters, ARIMA, and Isolation Forest are not in this build.
- The agent path sends one draft and one repair, then falls back. It is not a six-step tool loop. The allowlisted tools exist and the fast path calls the same engine functions.

## Git

This folder is not a git repository. Phase commits were not created.

## Recheck after the first build

The city-price card was comparing the probe with `lastTempC`. Once the clock copies the probe onto the truck, those two numbers match and the card vanished. It now uses the route ambient (or the reefer setpoint). A copied-probe test covers that. A failed hold or divert stays on screen instead of being cleared by the audit request. The panel marks the ledger anchored only when `/api/chain/live` reports the RPC is reachable.

## Known limits

- No local model is installed, so agent latency was not measured and is not reported as a pass.
- The panel was not clicked in a browser. This session has no browser tool. Map moves are covered by `store/coldgridStore.test.ts` (hub hold retargets the truck and keeps the original destination; sell mark stores ₹20).
- Browser ledger hashes are cyrb53. With the chain flag off, integrity says not anchored.
- Quiet hours are 22:00–07:00 local. A critical banner still shows.
