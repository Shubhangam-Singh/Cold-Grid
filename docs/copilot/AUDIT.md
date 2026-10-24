# ColdGrid copilot audit

Phase 0 recon. The code wins where this file and the super prompt disagree.

## Stack

- App: `coldgrid/`. Next.js 14.2.35 App Router, React 18, Zustand, Tailwind, Vitest, TypeScript strict.
- Admin map: `components/twin/TwinScreen.tsx` on `/`. The copilot panel is `components/learning/CopilotPanel.tsx`.
- No database, MQTT broker, or separate backend. The fleet lives in the browser store (`store/coldgridStore.ts`).
- Sensor path: ESP32 serial → `bridge/coldgrid_bridge.py` → WebSocket `ws://localhost:8765` → `HardwareBridge` → `liveHardwareStore`. Wi-Fi `PPSC_Cart` / `192.168.4.1` is the secondary path. Default hardware flag is off.
- Deploy: local `npm run dev` (localhost:3000). Not a hosted dashboard in this tree.

## Existing copilot

Files: `lib/copilot/heuristics.ts`, `heuristics.test.ts`, `components/learning/CopilotPanel.tsx`, `app/api/copilot/route.ts`.

`analyzeFleet` is a pure rules engine. Intents it still covers, and v2 still runs it on the probe-adjusted fleet:

- City heatwave when the scenario offset is at least 4°C.
- Closed roads.
- Spoiled load (quality 0).
- Will spoil before arrival, open truck versus reefer.
- Tight margin (life under 1.5× remaining travel).
- Over-cooled reefer.

`app/api/copilot/route.ts` calls Anthropic only when `NEXT_PUBLIC_ENABLE_COPILOT=true` and `ANTHROPIC_API_KEY` is set. The default response is `{ enabled: false }`. FROST does not call that route. The old button remains behind the same flag.

## Data model

- Shipments, batches, and readings are in-memory `Shipment` objects. Temperature is °C, humidity is %, VOC is the MQ-135 index, quality is 0–100, time is simulation hours plus `hourOfDay`.
- Cart frames are `SensorReading` (`tempC`, `humidity`, `gas`, `at` as unix seconds). A frame older than 6 seconds is stale.
- There is no device table, battery, or RSSI field.
- Browser ledger blocks use the in-app `LedgerBlock` type. Timestamps on those blocks are sequence numbers, not a time zone.

## Freshness engine

Lives in `lib/engine/spoilage.ts` and `lib/engine/produce.ts`. Firmware has its own 2-second λ. The website hour-scale λ is a different constant and is not used for the cart side-batch.

Shared constants: `R = 8.314`, `KELVIN = 273.15`, `T_REF_K = 298.15`. EMA step is `λ·EMA + (1−λ)·u_t`. Tomato example: Ea 109.7 kJ/mol, λ 0.93, stress 303.15 K, k0 `1.277e17`, list ₹20. Fish stress is 25°C, list ₹150. Hub storage is ₹250/h (`HUB_FEE_PER_HOUR_RUPEES`).

FROST calls `degradationSnapshot`, `predictedShelfLifeHours`, and `recommendSellPrice`. It does not reimplement them.

## Blockchain

Default ledger is the in-browser chain in `lib/chain/ledger.ts`. The hash is cyrb53, not keccak. `verifyChain` expects a genesis `prevHash` of `0x0`. The live cart uses `verifyOpenChain` on a trimmed window.

`contracts/ColdChainAttestation.sol` stores temperature in centi-°C and a breach count. It is used only when `NEXT_PUBLIC_ENABLE_CHAIN=true` and a contract address is set, against a local Hardhat node. That flag is off. `verify_integrity` therefore reports **not anchored** unless a snapshot says a chain RPC answered. A hash mismatch on blocks that do exist is critical.

## Risks

- The Claude route can leave the machine if the flag and an API key are both set. FROST does not use it.
- Mock chain output must not be described as mainnet. The integrity tool says not anchored.
- No private key is read by the copilot. Do not put `COLDGRID_ADMIN_KEY` in `.env`.
- One cart drives one in-transit truck. Other trucks stay synthetic.

## This PC (checked this session)

- Windows 11 Home, i5-1240P, 12 cores / 16 threads, 19.7 GB RAM, about 6.7 GB free.
- No `nvidia-smi`. Integrated graphics only.
- Disk free: C: about 25.3 GB, D: about 33.5 GB.
- Node v22.20.0. `ollama` is not on PATH. No model was pulled.
- CPU-only choice written in `copilot.config.yaml`: `llama3.2:3b`. It is not installed. Do not pull a 7B model into this free RAM.

## Connectivity

Choice (a). The admin UI is the local Next app. The browser calls same-origin `/api/copilot/v2/*`. Those routes check the Host is localhost, 127.0.0.1, or ::1, then proxy to `127.0.0.1:8787` with `COLDGRID_COPILOT_TOKEN` (default `coldgrid-local`, server-side only). If the sidecar is down, the routes answer from the rules engine and an in-process journal.

Port 8765 stays the cart bridge. The copilot uses 8787.

There is no database, so a read-only SQL user does not apply. The sidecar reads the snapshot the page posts. It does not open the WebSocket itself.
