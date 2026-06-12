export interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    rain: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
  };
}

export async function fetchChennaiWeather(): Promise<WeatherData | null> {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=13.0878&longitude=80.2785&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,rain&current=temperature_2m,relative_humidity_2m,weather_code,rain,wind_speed_10m&timezone=Asia%2FKolkata&past_days=1";
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch weather data:", res.statusText);
      return null;
    }
    const data = await res.json();
    return data as WeatherData;
  } catch (err) {
    console.error("Error fetching weather data:", err);
    return null;
  }
}
