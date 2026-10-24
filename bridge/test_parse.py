"""Stdlib tests for the serial parser. Run: python test_parse.py"""

import unittest

from parse_reading import parse_line


class ParseReadingTest(unittest.TestCase):
    def test_firmware_sens_line(self):
        frame = parse_line(
            "[SENS] T=31.4 H=78 VOC=240 raw=412 ADP PM=A Rt=1.023",
            now=1_700_000_000.0,
        )
        self.assertEqual(
            frame,
            {"tempC": 31.4, "humidity": 78.0, "gas": 240.0, "at": 1_700_000_000.0},
        )

    def test_legacy_g_equals(self):
        frame = parse_line("T=6.0,H=70,G=180", now=10)
        self.assertEqual(frame["tempC"], 6.0)
        self.assertEqual(frame["humidity"], 70.0)
        self.assertEqual(frame["gas"], 180.0)

    def test_ignores_boot_and_ml_lines(self):
        for line in (
            "PPSC v25 | Final Patent-Ready Firmware",
            "[SPIKE] +2.1C",
            "[PWR] A -> B (batt=80%)",
            "[ML-PONG] PPSC v24 ready",
            "[WiFi] HTTP server ready",
            "",
        ):
            self.assertIsNone(parse_line(line, now=1), line)

    def test_negative_temp(self):
        frame = parse_line("[SENS] T=-1.5 H=40 VOC=10 raw=1 FIX PM=A Rt=0.100", now=2)
        self.assertEqual(frame["tempC"], -1.5)


if __name__ == "__main__":
    unittest.main()
