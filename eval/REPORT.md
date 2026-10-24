# FROST eval

Run at: 2026-10-21T02:44:56.914Z
Exit code: 0

## Fast path

The vitest copilot suite passed.

```
 Test Files  4 passed (4)
      Tests  34 passed (34)
   Duration  2.43s (transform 769ms, setup 0ms, import 1.57s, tests 72ms, environment 0ms)
```

Numeric checks in this suite compare engine output with expected facts. They do not call a hosted model.

## Agent path

Skipped. Ollama is not installed on this PC, and no model was pulled. Latency for a local model was not measured. A rules answer is not counted as a model pass.

## Targets

- Excursion and tamper checks are in the detector and simulator tests.
- Sensor-fault F1 is asserted at or above 0.9 on the labelled set in `lib/copilot/copilot.test.ts`.
- Forecast MAE must beat the naive baseline on the straight series in that file.
- Golden questions: `eval/golden.yaml`, at least 60, checked by the same suite.
