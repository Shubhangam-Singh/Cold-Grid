# ColdGrid Hardware Bridge — Phase 10

A ~70-line Python bridge that reads the **PPSC smart cart's** serial output
(DHT22 temperature/humidity + MQ-135 gas) and rebroadcasts it as JSON over a
local WebSocket. The ColdGrid fleet monitor subscribes to it **only** when
`NEXT_PUBLIC_ENABLE_HARDWARE=true` and maps the live readings onto one designated
node (Kasimedu) — predicted shelf life against the cart's **actual** sensor data
in real time.

> Fully optional and free. With the flag off (the default), the app uses
> synthetic data and never connects here. No cloud, no keys, no real money.

## Run it

```bash
cd bridge
pip install -r requirements.txt

# With the real cart plugged in:
python coldgrid_bridge.py --port COM12               # Windows, PPSC USB (115200)
python coldgrid_bridge.py --port /dev/ttyUSB0         # Linux/Mac

# No hardware? Emit a synthetic warming trace to demo the app end-to-end:
python coldgrid_bridge.py --mock
```

Then enable the live node in `coldgrid/.env.local`:

```
NEXT_PUBLIC_ENABLE_HARDWARE=true
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

Open the site and turn **Real PPSC readings** on (`/hardware`, or the fleet
Operations switch). Warming the sensor drops that bench's predicted shelf life.
No `.env` restart is required. `NEXT_PUBLIC_ENABLE_HARDWARE=true` only makes
that switch start already on.

## Optional local chain

With a Hardhat node already deployed (`contracts/`: `npm run node`, then
`npm run deploy:local`):

```bash
# PowerShell
$env:COLDGRID_ATTESTATION_ADDRESS="0x..."   # address printed by deploy:local
python coldgrid_bridge.py --port COM12 --chain
```

`--chain` posts temperature to `ColdChainAttestation` for shipment `PPSC-LIVE`.
It does not post every 2-second sample. It posts the first sample, then again
when temperature crosses the threshold, moves by 1°C, or 60 seconds have passed.
On `http://127.0.0.1:8545` with no keys set, it uses Hardhat's public test
accounts (account 0 deploys and grants the transporter role, account 1 attests).
Set `COLDGRID_ADMIN_KEY` and `COLDGRID_TRANSPORTER_KEY` yourself for any other RPC.
Do not point this at mainnet.

In the site, `NEXT_PUBLIC_ENABLE_CHAIN=true` plus `NEXT_PUBLIC_CONTRACT_ADDRESS`
shows the on-chain breach count next to the live ledger. The browser never holds a key.

## Cart serial format

The v25 firmware prints one reading every 2 seconds at **115200** baud:

```
[SENS] T=31.4 H=78 VOC=240 raw=412 ADP PM=A Rt=1.023
```

The bridge also accepts the older `T=31.4,H=78,G=240` form. Boot, spike, power,
and ML lines are ignored. Each accepted reading is printed as one JSON line and
rebroadcast on the websocket.
