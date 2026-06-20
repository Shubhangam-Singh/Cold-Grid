# ColdGrid Hardware Bridge — Phase 10

A ~70-line Python bridge that reads the **PPSC smart cart's** serial output
(DHT22 temperature/humidity + MQ-135 gas) and rebroadcasts it as JSON over a
local WebSocket. The ColdGrid app subscribes to it **only** when
`NEXT_PUBLIC_ENABLE_HARDWARE=true` and maps the live readings onto one designated
node (Kasimedu) — so the twin shows the model's **predicted** shelf life against
the cart's **actual** sensor data in real time.

> Fully optional and free. With the flag off (the default), the app uses
> synthetic data and never connects here. No cloud, no keys, no real money.

## Run it

```bash
cd bridge
pip install -r requirements.txt

# With the real cart plugged in:
python coldgrid_bridge.py --port COM3 --baud 9600     # Windows
python coldgrid_bridge.py --port /dev/ttyUSB0         # Linux/Mac

# No hardware? Emit a synthetic warming trace to demo the app end-to-end:
python coldgrid_bridge.py --mock
```

Then enable the live node in `coldgrid/.env.local`:

```
NEXT_PUBLIC_ENABLE_HARDWARE=true
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

Open `/hardware` in the app. Warming the sensor (a hand on the probe) visibly
drops that node's predicted shelf life on screen.

## Cart serial format

The cart should print one reading per line; the bridge extracts `T=`, `H=`, `G=`
in any order, e.g.:

```
T=31.4,H=78,G=240
```

Unparseable lines are ignored, so existing debug output is harmless.
