#!/usr/bin/env python3
"""
ColdGrid hardware bridge (Phase 10) — reads the PPSC cart's serial output
(DHT22 temp/humidity + MQ-135 gas) and rebroadcasts it as JSON over a WebSocket
the ColdGrid app subscribes to when NEXT_PUBLIC_ENABLE_HARDWARE=true.

Optional + free: with the flag off the app uses synthetic data and never
connects here. No cloud, no keys, no real money.

  pip install -r requirements.txt
  python coldgrid_bridge.py --port COM12 --ws 8765
  python coldgrid_bridge.py --mock          # no hardware needed (synthetic warming trace)

Firmware (115200 baud) prints:  [SENS] T=31.4 H=78 VOC=240 raw=412 ADP PM=A Rt=1.023
The older T=31.4,H=78,G=240 form is accepted too. Other lines are ignored.
"""
import argparse
import asyncio
import json
import math
import subprocess
import threading
import time
from pathlib import Path

from parse_reading import parse_line

try:
    import websockets
except ImportError:
    raise SystemExit("Missing dependency. Run:  pip install -r requirements.txt")

clients = set()
chain_proc: subprocess.Popen | None = None


def start_chain_poster() -> subprocess.Popen | None:
    """Optional local-chain writer. A failure here must not stop the websocket."""
    script = Path(__file__).with_name("chain_poster.mjs")
    try:
        proc = subprocess.Popen(
            ["node", str(script)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except OSError as exc:
        print(f"[chain] poster not started: {exc}")
        return None

    def pump() -> None:
        if proc.stdout is None:
            return
        for line in proc.stdout:
            print(line.rstrip(), flush=True)

    threading.Thread(target=pump, daemon=True).start()
    print("[chain] poster started (local node only)")
    return proc


def forward_chain(reading: dict) -> None:
    proc = chain_proc
    if proc is None or proc.poll() is not None or proc.stdin is None:
        return
    try:
        proc.stdin.write(json.dumps(reading) + "\n")
        proc.stdin.flush()
    except OSError as exc:
        print(f"[chain] write failed: {exc}")


async def publish(reading: dict) -> None:
    print(json.dumps(reading), flush=True)
    forward_chain(reading)
    await broadcast(reading)


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
            await publish(reading)


async def mock_reader() -> None:
    """Synthetic warming/cooling trace so the app can be demoed without hardware."""
    print("[bridge] MOCK mode — emitting a synthetic warming trace")
    t = 0.0
    while True:
        temp = 6 + 24 * (0.5 - 0.5 * math.cos(t / 8))  # 6 -> 30 -> 6 C
        reading = {
            "tempC": round(temp, 1),
            "humidity": round(70 + 10 * math.sin(t / 5), 1),
            "gas": round(180 + temp * 4, 1),
            "at": time.time(),
        }
        await publish(reading)
        t += 1
        await asyncio.sleep(1)


async def main() -> None:
    p = argparse.ArgumentParser(description="ColdGrid hardware bridge (serial -> websocket)")
    p.add_argument("--port", help="serial port, e.g. COM3 or /dev/ttyUSB0")
    p.add_argument("--baud", type=int, default=115200, help="serial baud (firmware uses 115200)")
    p.add_argument("--ws", type=int, default=8765, help="websocket port")
    p.add_argument("--mock", action="store_true", help="emit synthetic data (no hardware)")
    p.add_argument(
        "--chain",
        action="store_true",
        help="also post to a local Hardhat ColdChainAttestation (never mainnet)",
    )
    args = p.parse_args()

    global chain_proc
    if args.chain:
        chain_proc = start_chain_poster()

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
