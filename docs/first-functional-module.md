# Course Project — First Functional Module

**Project:** ColdGrid — live monitor for trucks carrying a PPSC unit  
**Author:** Shubhangam Singh  
**Module submitted:** Spoilage and dynamic sell-price engine (the first functional core)  
**Focus of this submission:** setup and the initial implementation of that module

This note answers the course brief for the first functional module. Every claim below is taken from the current source in `coldgrid/`. It is a description of the code, not a claim that the whole product is finished.

---

## 1. What this module represents

The first functional module is the **spoilage and pricing engine**.

It is the part of ColdGrid that answers two questions for a truck carrying perishable food:

1. How fast is this load deteriorating right now, given temperature, humidity, and gas?
2. At what price should it be sold, given how much freshness is left?

The same idea already runs on the physical PPSC cart (`esp32_firmware.cpp`, model string `PPSC-v25-final`). ColdGrid is the city-scale version: many trucks, each treated as carrying a PPSC unit, moving on a map of Chennai and the surrounding Tamil Nadu region. This module is the shared physics. The map, the academy, and the optional ledger sit on top of it. They are not this submission.

In the running app the module shows up as:

- the quality bar, Arrhenius rate, hours left, and **Sell at ₹…** on each live truck card (bottom-left of the map)
- the same numbers on the fleet list
- the hardware bench at `/hardware`, which can step the same equations from a real cart

---

## 2. Purpose and functionality

Food does not spoil at a constant speed. Heat speeds the chemistry up, and earlier heat is not forgotten when the truck cools down again. The module models that.

For every tick, for one batch of one produce, it does eight steps. The code is `stepBatch` in `lib/engine/spoilage.ts`. The comments there match `updateDegradationAdaptive` in the firmware.

| Step | What it does | Where |
|---|---|---|
| 1 | Thermal stress `u_t = max(0, (T_K − thermalStressK) / 10)` | `emaUpdate` |
| 2 | Running average of that stress: `EMA = λ·EMA + (1−λ)·u_t` | `emaUpdate` |
| 3–4 | Only that memory changes activation energy: `F = max(fMin, 1 − γ·EMA)`, then `Ea_eff = clamp(F·Ea, eaMinFrac·Ea, Ea)` | `thermalDerating` |
| 5 | Arrhenius rate relative to 25 °C: `baseRate = exp((Ea/T_ref − Ea_eff/T) / R)` | `baseRate` |
| 6 | Humidity is a multiplier **after** the exponent, capped at `1 + β` | `humidityMultiplier` |
| 7 | Gas/VOC is a multiplier **after** the exponent, capped at `1 + α`. Leafy vegetables also get a desiccation penalty below 60 %RH | `gasMultiplier`, leafy branch in `humidityMultiplier` |
| 8 | `rate = baseRate · H · G`. Quality falls by `rate · dt / shelfLifeHours` | `stepBatch` |

`R = 8.314` J/(mol·K). Reference temperature is 25 °C (`T_REF_K = 298.15`). Activation energies are stored in J/mol (the literature table is in kJ/mol, multiplied by 1000 in one place in `produce.ts`).

`degradationSnapshot` does not advance the batch. It reports the live numbers the screen needs:

- rate versus a 25 °C reference (`×`)
- quality points lost per hour
- hours until quality hits 0 if the current temperature, humidity, and gas hold

The sell price is the five-band rule copied from the firmware (`updateDegradation` in `esp32_firmware.cpp`), implemented in `lib/engine/pricing.ts`:

| Freshness | Price |
|---|---|
| above 80% | 100% of list |
| above 60% | 85% |
| above 40% | 65% |
| above 20% | 40% |
| above 0% and at or below 20% | 15% |
| expired (0%) | ₹0 |

List prices are the firmware `basePrice` values, in rupees per unit: tomato 20, banana 15, apple 80, leafy veg 30, mango 60, milk 25, fish 150, paneer 90.

---

## 3. How this module contributes to the whole project

ColdGrid’s job is to watch a fleet. A truck’s position is useless for cold-chain work unless the operator can see whether the cargo is still sellable.

This module is what turns a GPS point and three sensor numbers into:

- a freshness percentage
- a deterioration rate
- a recommended selling price

Everything else in the repo uses that result or sits beside it:

- the map and the simulation move the truck and feed it a temperature, humidity, and gas reading
- the fleet panel and the tracking cards only display what this module computes
- the academy scores deliveries using the same quality number
- the optional trust-layer page can later attest temperatures; it does not compute spoilage

Without this module the app would be a map of trucks. With it, the map is a monitor.

---

## 4. How the submitted code works

The engine is plain TypeScript. It does not import React. The screen calls the engine. The engine never calls the screen.

### Data

`lib/engine/types.ts`

- `ProduceId` — eight foods: tomato, banana, apple, leafy veg, mango, milk, fish, paneer
- `ProduceProfile` — Arrhenius constants, EMA constants, humidity and gas shape, and `basePriceRs`
- `Batch` — one load: EMA state, quality 0–100, cumulative degradation, age, breach count, history

`lib/engine/produce.ts` holds the eight profiles. Shelf lives (hours at 25 °C): tomato 90, banana 120, apple 168, leafy veg 48, mango 96, milk 5.5, fish 17.4, paneer 24. Activation energies (kJ/mol) match the firmware comments: 109.7, 60.9, 90.0, 44.5, 50.0, 90.0, 82.9, 52.8.

One deliberate difference from the cart: the firmware’s λ values (about 0.995 to 0.9975) were derived for a **2-second** sensor loop. ColdGrid’s simulation step is `SIM_DT_HOURS = 0.01` (36 seconds). Copying the 2-second λ into that step would freeze thermal memory. The website therefore keeps the hour-scale λ already used by the sim (fish 0.87 through apple 0.94). Humidity, gas, γ, floors, k0, and list price **are** the firmware table.

### Main functions

| Function | File | Role |
|---|---|---|
| `emaUpdate`, `thermalDerating`, `baseRate` | `spoilage.ts` | the Arrhenius + memory core |
| `humidityMultiplier`, `gasMultiplier` | `spoilage.ts` | post-multipliers, with the firmware caps |
| `stepBatch` | `spoilage.ts` | one pure tick; returns a new batch, does not mutate the old one |
| `degradationSnapshot` | `spoilage.ts` | live rate, %/hour, hours left |
| `predictedShelfLifeHours` | `spoilage.ts` | “if I hold it at this temperature, how long is left?” (humidity and gas at reference) |
| `recommendSellPrice` | `pricing.ts` | the five-band rupee price |
| `createBatch`, `isSpoiled` | `spoilage.ts` | start state and the spoiled check |
| `mulberry32` | `rng.ts` | the only random source; same seed, same sequence |
| `syntheticSensors`, `stepSimulation`, `dispatchShipment` | `simulation.ts` | city tick: move the truck, then call `stepBatch` |

`simulation.ts` is the bridge from “one batch in a lab” to “a truck on a road”. Each tick:

1. looks up the road the truck is on
2. uses the reefer setpoint if there is one, otherwise the road’s ambient temperature
3. builds a deterministic sensor reading from `(seed, truck id, tick)` — not `Math.random()`, not the wall clock
4. calls `stepBatch`
5. advances the truck along the stored road geometry

### What the screen does with it

| Component | Role |
|---|---|
| `components/twin/CargoHealth.tsx` | draws rate, loss per hour, hours left, and the sell price |
| `components/twin/TrackingCard.tsx` | one card per in-transit truck, newest above older ones; each card can be minimized to a chip |
| `components/twin/ShipmentPanel.tsx` | fleet list: GPS, T / RH / VOC, compact rate and price |
| `components/hardware/LiveNodePanel.tsx` | if a real cart is connected, each new reading calls `stepBatch` |

---

## 5. Technologies and tools

For **this module**:

| Tool | Why it is here |
|---|---|
| TypeScript (strict) | the engine, the types, and the tests |
| Vitest 4 | headless tests; no browser required for the physics |
| Node.js ≥ 18 | runs the tests and the Next.js dev server |

The module is shown inside the wider app, which also uses:

| Tool | Why it is here |
|---|---|
| Next.js 14 (App Router) and React 18 | the pages |
| Tailwind CSS | the control-room styling |
| Zustand | the live simulation state the cards read |
| deck.gl and MapLibre | the map the trucks move on (no paid map key) |

No database. Nothing is written to disk by this module. State lives in memory and is gone on refresh.

The physical cart (not required to run the website) is an ESP32 DevKit with a DHT22 and an MQ-135. Its source is `esp32_firmware.cpp`. The optional Python bridge is `bridge/coldgrid_bridge.py` (pyserial + websockets).

---

## 6. Blockchain — platform, wallet, contracts

**Not used by this module.**

The first module does not connect to a chain, a wallet, or a contract. Spoilage and price are computed in the browser (or in Vitest) from the equations above.

A later, separate piece exists in the repo and is switched **off** by default (`NEXT_PUBLIC_ENABLE_CHAIN=false` in `.env.example`):

| Piece | What it actually is |
|---|---|
| `lib/chain/` | an in-browser hash-linked ledger (a teaching simulation, not a blockchain network) |
| `contracts/contracts/ColdChainAttestation.sol` | Solidity 0.8.24, OpenZeppelin `AccessControl`. A transporter can post a temperature; readings over a threshold increment `breachCount` |
| `contracts/contracts/ComplianceEscrow.sol` | a buyer can fund a deal; settlement reads the breach count and pays the supplier minus a penalty |
| `contracts/hardhat.config.ts` | Hardhat, **localhost only** (`http://127.0.0.1:8545`). No mainnet is configured |
| `lib/chain/onchain.ts` | if the flag and a contract address are both set, it tries to **read** `breachCountByName`. It does not send attestations or fund escrow from the app. `ethers` is not a dependency of the main app |

There is no wallet integration in the running UI. Hardhat’s local node would use its own unlocked test accounts if someone deployed the contracts by hand. That path is not part of the first module, and it is not on by default.

---

## 7. How blockchain is incorporated

**It is not incorporated into this module.**

The design intention, visible in `lib/chain/` and `contracts/`, is a later trust layer: temperature readings could be attested, and a delivery payment could be reduced when the on-chain breach count is too high. The oracle in that design is the simulation itself. The contracts are a local Hardhat twin of the in-app ledger.

For this submission, spoilage and price do not read or write any chain. Turning the chain flag on does not change `stepBatch` or `recommendSellPrice`.

---

## 8. Data used to build and test the module

There is no external dataset and no database.

**Produce constants** come from the PPSC v25 firmware table, which cites published food-science sources in comments (for example Kale & Nath 2018 for tomato Ea, Disney 1969 / ICAR for fish, Dalavi 2025 for banana). Those numbers are hard-coded in `lib/engine/produce.ts`. They are not loaded from a file at runtime.

**Sensor input** in normal use is synthetic and deterministic:

- temperature = road ambient (or the reefer setpoint) plus small noise from `mulberry32`
- relative humidity around the produce’s reference
- VOC rises as the batch’s own cumulative degradation rises

The same `(seed, truck, tick)` always yields the same reading. The default simulation seed is `12345`.

**A real cart** is optional. The bridge expects lines shaped like `T=31.4,H=78,G=240`. With the hardware flag off, the app never opens a socket.

**Tests** do not use recorded trips. They feed constant temperatures and check the equations. The important numeric lock is in `lib/engine/spoilage.test.ts`:

- tomato at 35 °C, no thermal-memory derating, `baseRate ≈ 4.2045`
- that value is `exp((109700/298.15 − 109700/308.15) / 8.314)`
- if Ea were left in kJ instead of J, the same expression would be about `1.00`, and the test fails

Other checks in the same file:

- quality never rises and never goes below 0
- a hotter run loses quality faster than a cooler run
- higher λ means more thermal inertia (apple 0.94 responds more slowly than fish 0.87)
- humidity and gas multipliers are at least 1, and humidity is capped at `1 + β`
- leafy veg below 60 %RH gets the desiccation multiplier
- fish held at 30 °C for 24 one-hour steps is spoiled; apple in the same conditions is not
- two runs with the same inputs are identical
- `stepBatch` does not mutate its input

`lib/engine/pricing.test.ts` locks the firmware bands on fish (list ₹150): 81% → ₹150, 80% → ₹127.5, 60% → ₹97.5, 40% → ₹60, 20% → ₹22.5, 0% → ₹0.

`lib/engine/simulation.test.ts` checks that a dispatched fish truck actually moves, degrades, and that a reefer holds quality better than an open truck.

---

## 9. Setup required to run this module

From the `coldgrid` directory:

```bash
npm install
npm test
npm run dev
```

Then open `http://localhost:3000`.

No `.env.local` is required. If that file is absent, copilot, chain, and hardware stay off, and the module uses synthetic sensors.

To see the module on screen:

1. Press **Play**.
2. Dispatch a truck (for example “Fish · Kasimedu → Mylapore”).
3. The bottom-left card shows live rate, quality loss per hour, hours left, and **Sell at**.
4. Dispatch a second truck. The newer card stacks above the older one. **▾** minimizes a card to a chip; the chip stays until that truck is delivered.

Headless check of the module alone:

```bash
npm test -- lib/engine/spoilage.test.ts lib/engine/pricing.test.ts lib/engine/simulation.test.ts
```

Optional hardware (not needed for the first module):

```bash
cd bridge
pip install -r requirements.txt
python coldgrid_bridge.py --mock
```

Then set `NEXT_PUBLIC_ENABLE_HARDWARE=true` and `NEXT_PUBLIC_WS_URL=ws://localhost:8765` in `.env.local`, restart `npm run dev`, and open `/hardware`.

---

## 10. Working status — inputs, outputs, tests

### Input → output (one tick)

Input to `stepBatch`: a batch, a produce profile, temperature °C, relative humidity, VOC, and `dt` in hours.

Output: a **new** batch. Quality is `(1 − cumulativeDeg) × 100`, clamped to 0–100. History gains one point. The input object is unchanged.

Example locked by the unit test (fresh tomato, EMA = 0, 35 °C, humidity and VOC at their reference so H = G = 1):

| Quantity | Value |
|---|---|
| Input temperature | 35 °C |
| `baseRate` / snapshot rate | ≈ 4.2045 × the 25 °C rate |
| Hours left | `90 / 4.2045` ≈ 21.4 h (full shelf is 90 h) |

Example locked by the price test (fish, list ₹150):

| Freshness in | Recommended price out |
|---|---|
| 100% | ₹150 (hold, grade A) |
| 80% | ₹127.5 (15% off) |
| 40% | ₹60 (60% off) |
| 0% | ₹0 (do not sell) |

### Test run

Command: `npm test` in `coldgrid` (Vitest 4.1.8).

Last full run during this implementation:

- 17 test files passed
- **158 tests passed**
- engine files included in that run: `spoilage.test.ts` (22), `pricing.test.ts` (3), `simulation.test.ts` (16), `rng.test.ts` (6)

`npm run lint` reported no ESLint warnings or errors.

### What to screenshot for the submission

The automated tests do not click the UI. Capture these yourself after `npm run dev`:

1. Home page after dispatching one fish truck: tracking card with quality, Arrhenius rate, and sell price.
2. Two trucks: newer card above the older chip.
3. Terminal output of `npm test` showing the spoilage and pricing files passing.

Those three images are the demonstration. The numbers in the tables above are the corresponding inputs and outputs.

---

## Files that are this module

Submit these if the brief asks for about the first 30–40% of the implementation. They are the physics, the price rule, the tests, and the screens that show them.

```
lib/engine/types.ts
lib/engine/produce.ts
lib/engine/spoilage.ts
lib/engine/pricing.ts
lib/engine/rng.ts
lib/engine/simulation.ts
lib/engine/spoilage.test.ts
lib/engine/pricing.test.ts
lib/engine/simulation.test.ts
lib/engine/rng.test.ts
components/twin/CargoHealth.tsx
components/twin/TrackingCard.tsx
components/twin/ShipmentPanel.tsx
components/hardware/LiveNodePanel.tsx
esp32_firmware.cpp          (the cart this module was matched to)
```

`app/page.tsx`, `store/coldgridStore.ts`, and `lib/city/chennai.ts` are needed to boot the map, but they are the shell around the module, not the module itself.

---

## What this submission is not

- It is not the academy, the citizen page, or the PDF certificate.
- It is not a live blockchain deployment. Contracts in `contracts/` compile as their own Hardhat package. The website does not call them unless a developer turns a flag on and points it at a local node, and even then the app only attempts a read.
- It does not claim a measured frame rate, a user study, or production traffic. None of those were measured.
