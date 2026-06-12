"use client";

import { useColdgridStore } from "@/store/coldgridStore";
import { useEffect } from "react";

export default function WeatherWidget() {
  const weatherData = useColdgridStore((s) => s.weatherData);
  const liveWeatherEnabled = useColdgridStore((s) => s.liveWeatherEnabled);
  const toggleLiveWeather = useColdgridStore((s) => s.toggleLiveWeather);
  const fetchWeather = useColdgridStore((s) => s.fetchWeather);

  useEffect(() => {
    fetchWeather();
    // Refresh every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  if (!weatherData) return null;

  const current = weatherData.current;
  // Map WMO weather codes to emojis
  const getWeatherEmoji = (code: number) => {
    if (code <= 1) return "☀️";
    if (code <= 3) return "⛅";
    if (code <= 49) return "🌫️";
    if (code <= 69) return "🌧️";
    if (code <= 79) return "❄️";
    if (code <= 99) return "⛈️";
    return "☁️";
  };

  return (
    <div className="z-10 rounded-lg border border-slate-800 bg-slate-950/90 p-3 backdrop-blur shadow-lg w-48">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
          Chennai Weather
        </span>
        <button
          onClick={toggleLiveWeather}
          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
            liveWeatherEnabled
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/50 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
              : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
          } transition-all`}
        >
          {liveWeatherEnabled ? "LIVE ON" : "LIVE OFF"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl drop-shadow-md">
          {getWeatherEmoji(current.weather_code)}
        </span>
        <div>
          <div className="text-xl font-bold text-slate-100 font-mono tracking-tight">
            {current.temperature_2m.toFixed(1)}°C
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {current.relative_humidity_2m}% RH
          </div>
        </div>
      </div>
      
      {current.rain > 0 && (
        <div className="mt-2 text-[10px] text-blue-400 font-medium flex items-center gap-1">
          <span>💧</span> Rain: {current.rain} mm
        </div>
      )}
    </div>
  );
}
