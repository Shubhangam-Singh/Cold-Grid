#!/usr/bin/env python3
"""
ColdGrid hardware bridge (Phase 10) — reads the PPSC cart's serial output
(DHT22 temp/humidity + MQ-135 gas) and rebroadcasts it as JSON over a WebSocket
the ColdGrid app subscribes to when NEXT_PUBLIC_ENABLE_HARDWARE=true.

Optional + free: with the flag off the app uses synthetic data and never
connects here. No cloud, no keys, no real money.

  pip install -r requirements.txt
  python coldgrid_bridge.py --port COM3 --baud 9600 --ws 8765
  python coldgrid_bridge.py --mock          # no hardware needed (synthetic warming trace)

The cart is expected to print lines like:  T=31.4,H=78,G=240
(temperature C, relative humidity %, gas/VOC index). Unparseable lines are ignored.
"""
import argparse
import asyncio
import json
import math
import re
import time

try:
    import websockets
except ImportError:
    raise SystemExit("Missing dependency. Run:  pip install -r requirements.txt")

# Pulls T=, H=, G= out of a line in any order/format.
LINE_RE = re.compile(
    r"T\s*=\s*(-?\d+(?:\.\d+)?).*?H\s*=\s*(-?\d+(?:\.\d+)?).*?G\s*=\s*(-?\d+(?:\.\d+)?)",
    re.IGNORECASE,
)

clients = set()


async def broadcast(payload: dict) -> None:
    if not clients:
        return
    msg = json.dumps(payload)
    await asyncio.gather(*(c.send(msg) for c in list(clients)), return_exceptions=True)


async def handler(ws, *_) -> None:  # *_ tolerates the older (ws, path) signature
    clients.add(ws)
    try:
        await ws.wait_closed()
    finally:
        clients.discard(ws)


def parse_line(text: str):
    m = LINE_RE.search(text)
    if not m:
        return None
    return {
        "tempC": float(m.group(1)),
        "humidity": float(m.group(2)),
        "gas": float(m.group(3)),
        "at": time.time(),
    }


async def serial_reader(port: str, baud: float) -> None:
    import serial  # pyserial, imported lazily so --mock needs no hardware libs

    loop = asyncio.get_event_loop()
    ser = serial.Serial(port, baud, timeout=1)
    print(f"[bridge] reading {port} @ {baud:g} baud")
    while True:
        raw = await loop.run_in_executor(None, ser.readline)
        text = raw.decode("utf-8", "ignore").strip()
        reading = parse_line(text)
        if reading:
            await broadcast(reading)


async def mock_reader() -> None:
    """Synthetic warming/cooling trace so the app can be demoed without hardware."""
    print("[bridge] MOCK mode — emitting a synthetic warming trace")
    t = 0.0
    while True:
        temp = 6 + 24 * (0.5 - 0.5 * math.cos(t / 8))  # 6 -> 30 -> 6 C
        await broadcast(
            {
                "tempC": round(temp, 1),
                "humidity": round(70 + 10 * math.sin(t / 5), 1),
                "gas": round(180 + temp * 4, 1),
                "at": time.time(),
            }
        )
        t += 1
        await asyncio.sleep(1)


async def main() -> None:
    p = argparse.ArgumentParser(description="ColdGrid hardware bridge (serial -> websocket)")
    p.add_argument("--port", help="serial port, e.g. COM3 or /dev/ttyUSB0")
    p.add_argument("--baud", type=float, default=9600)
    p.add_argument("--ws", type=int, default=8765, help="websocket port")
    p.add_argument("--mock", action="store_true", help="emit synthetic data (no hardware)")
    args = p.parse_args()

    async with websockets.serve(handler, "0.0.0.0", args.ws):
        print(f"[bridge] websocket on ws://localhost:{args.ws}")
        if args.mock or not args.port:
            await mock_reader()
        else:
            await serial_reader(args.port, args.baud)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[bridge] stopped")
