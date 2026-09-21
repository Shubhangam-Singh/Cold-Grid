# ColdGrid — PPSC Fleet Monitor

![ColdGrid](https://img.shields.io/badge/ColdGrid-PPSC_Fleet_Monitor-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![deck.gl](https://img.shields.io/badge/deck.gl-GeoJSON-brightgreen?style=for-the-badge)
![Testing](https://img.shields.io/badge/Vitest-Passing-success?style=for-the-badge)

**ColdGrid** is a live monitoring console for reefer trucks that carry a **PPSC** unit (DHT22 temperature/humidity + MQ-135 gas). It tracks each truck across **Chennai and the surrounding Tamil Nadu region**, shows cargo sensors and GPS on the map, and turns those readings into remaining shelf life using an Adaptive Arrhenius + EMA spoilage model.

An optional **Academy** still exists as operator training. It is not the product — the fleet monitor is.

---

## What you see

### Fleet operations (home)
- Real road geometries on a MapLibre + deck.gl map (Chennai plus satellite hubs: Kanchipuram, Vellore, Puducherry, Chengalpattu, and more).
- Each in-transit truck is a PPSC unit (`PPSC-001`…) with live GPS, cargo temperature, humidity, VOC, and quality.
- Alerts when cargo is over its thermal-stress ceiling or quality drops to 50% or below.
- Dispatch trucks, pick a route (fastest / shortest / coolest), assign a driver, and watch the run.

### Optional PPSC hardware
A Python serial → WebSocket bridge can stream a **real** PPSC cart into `/hardware`. Flag off (the default) uses synthetic sensors so the app still runs with zero setup.

### Optional extras
- **Academy** — five crisis scenarios (heatwave, grid outage, monsoon, festival surge) for operator practice.
- **Citizen** — one-slider explainer of the cost vs freshness tradeoff.
- **Trust Layer** — a simulated tamper-evident ledger. Smart contracts exist in `contracts/` and are **not** called by the running app.

---

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Maps**: deck.gl, MapLibre (no paid map key)
- **Charts**: Recharts (lazy-loaded)
- **Tests**: Vitest

---

## Getting started

Node.js >= 18.

```bash
git clone https://github.com/Shubhangam-Singh/Cold-Grid.git
cd coldgrid
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the fleet monitor.

Copy `.env.example` to `.env.local` only if you want optional hardware, chain, or AI copilot. All of those default **off**.

---

## Testing

```bash
npm test
```

152 tests across the spoilage model, city graph, routing, academy scoring, and fleet helpers.

---

## Author

**Shubhangam Singh**
- GitHub: [@Shubhangam-Singh](https://github.com/Shubhangam-Singh)
