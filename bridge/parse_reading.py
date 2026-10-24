"""Parse one PPSC serial line into a sensor frame.

The v25 firmware prints, every 2 seconds at 115200 baud:

    [SENS] T=31.4 H=78 VOC=240 raw=412 ADP PM=A Rt=1.023

Older bridge examples used G= for gas. Both are accepted. Any other line
(spike, power, ML, boot text) returns None.
"""

from __future__ import annotations

import re
import time

# T, then H, then gas as VOC= or G=, in that order. Firmware and the old
# "T=..,H=..,G=.." example both match. Groups are temp, humidity, gas.
SENS_RE = re.compile(
    r"T\s*=\s*(-?\d+(?:\.\d+)?)"
    r".*?H\s*=\s*(-?\d+(?:\.\d+)?)"
    r".*?(?:VOC|G)\s*=\s*(-?\d+(?:\.\d+)?)",
    re.IGNORECASE,
)


def parse_line(text: str, now: float | None = None) -> dict | None:
    match = SENS_RE.search(text)
    if not match:
        return None
    return {
        "tempC": float(match.group(1)),
        "humidity": float(match.group(2)),
        "gas": float(match.group(3)),
        "at": time.time() if now is None else now,
    }
