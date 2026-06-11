"use client";

/**
 * City clock control: scrub the hour of day and watch every node ring re-color
 * as the diurnal ambient shifts. (No simulation yet — this just drives the
 * Phase 2 ambient model, proving the data → engine → map wiring is live.)
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { tempToRgb, rgbCss } from "./colors";

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CityClock() {
  const hourOfDay = useColdgridStore((s) => s.sim.hourOfDay);
  const setHourOfDay = useColdgridStore((s) => s.setHourOfDay);
  const ambientC = useColdgridStore((s) => s.currentAmbientC());

  return (
    <div className="w-72 rounded-xl glass-panel p-4 animate-slide-up">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          City clock
        </span>
        <span className="font-mono text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          {formatHour(hourOfDay)}
        </span>
      </div>

      <label className="sr-only" htmlFor="city-clock">
        Hour of day
      </label>
      <input
        id="city-clock"
        type="range"
        min={0}
        max={23.5}
        step={0.5}
        value={hourOfDay}
        onChange={(e) => setHourOfDay(Number(e.target.value))}
        className="mt-3 w-full accent-twin-cyan cursor-pointer"
        aria-valuetext={`${formatHour(hourOfDay)}, city ambient ${ambientC.toFixed(1)} degrees`}
      />

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-slate-400">City ambient</span>
        <span
          className="font-mono font-bold text-glow text-sm"
          style={{ color: rgbCss(tempToRgb(ambientC)) }}
        >
          {ambientC.toFixed(1)}°C
        </span>
      </div>
    </div>
  );
}
