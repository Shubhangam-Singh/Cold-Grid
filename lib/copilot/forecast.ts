/**
 * One-step cargo-temperature forecast.
 * Slope and "hold the last reading" are both scored on the same history.
 * The point that is returned is the one with the lower backtest error.
 * Fewer than 4 samples is not a forecast.
 */

export interface ForecastResult {
  method: "slope" | "naive";
  horizon: number;
  point: number;
  /** Error of the method that was kept. */
  mae: number;
  naiveMae: number;
  slopeMae: number;
  samples: number;
}

function maeOf(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
}

function predictNext(prefix: number[]): { slope: number; naive: number } {
  const last = prefix[prefix.length - 1];
  const prev = prefix[prefix.length - 2];
  return { slope: last + (last - prev), naive: last };
}

export function forecastSeries(values: number[], horizon = 1): ForecastResult | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 4 || horizon < 1) return null;

  const slopeErr: number[] = [];
  const naiveErr: number[] = [];
  for (let index = 3; index < clean.length; index++) {
    const predicted = predictNext(clean.slice(0, index));
    slopeErr.push(predicted.slope - clean[index]);
    naiveErr.push(predicted.naive - clean[index]);
  }

  const slopeMae = maeOf(slopeErr);
  const naiveMae = maeOf(naiveErr);
  const method: ForecastResult["method"] = slopeMae <= naiveMae ? "slope" : "naive";

  const extended = clean.slice();
  for (let step = 0; step < horizon; step++) {
    const predicted = predictNext(extended);
    extended.push(method === "slope" ? predicted.slope : predicted.naive);
  }

  return {
    method,
    horizon,
    point: extended[extended.length - 1],
    mae: method === "slope" ? slopeMae : naiveMae,
    naiveMae,
    slopeMae,
    samples: clean.length,
  };
}
