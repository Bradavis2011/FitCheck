/**
 * Weather Service
 *
 * Uses Open-Meteo (https://open-meteo.com) — no API key required.
 * Geocoding: Open-Meteo Geocoding API (https://geocoding-api.open-meteo.com)
 * Forecast: Open-Meteo Forecast API (https://api.open-meteo.com)
 *
 * Results are cached in-memory for 1 hour to avoid excessive API calls.
 *
 * New env vars: none — Open-Meteo is free with no auth.
 */

export interface WeatherContext {
  city: string;
  tempCelsius: number;
  tempFahrenheit: number;
  condition: string;          // "sunny", "partly_cloudy", "cloudy", "rainy", "snowy", "windy"
  description: string;        // Human-readable: "45°F, partly cloudy"
  promptText: string;         // For injection into AI prompt
  feelsLike: string;          // "warm", "mild", "cool", "cold", "freezing"
}

// ─── In-memory cache (1 hour TTL) ─────────────────────────────────────────────

interface CacheEntry {
  data: WeatherContext;
  expiresAt: number;
}

const weatherCache = new Map<string, CacheEntry>();
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(city: string): WeatherContext | null {
  const entry = weatherCache.get(city.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    weatherCache.delete(city.toLowerCase());
    return null;
  }
  return entry.data;
}

function setCached(city: string, data: WeatherContext): void {
  weatherCache.set(city.toLowerCase(), {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── Geocoding ─────────────────────────────────────────────────────────────────

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const cacheKey = city.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> };
    const first = data.results?.[0];
    if (!first) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const coords = { lat: first.latitude, lon: first.longitude };
    geocodeCache.set(cacheKey, coords);
    return coords;
  } catch (err) {
    console.warn('[WeatherService] Geocoding failed for', city, err);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

// ─── WMO weather code → condition string ───────────────────────────────────────
// https://open-meteo.com/en/docs — weathercode interpretation

function wmoToCondition(code: number): string {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'partly_cloudy';
  if (code <= 48) return 'cloudy'; // fog codes included
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  if (code <= 82) return 'rainy';
  if (code <= 86) return 'snowy';
  if (code <= 99) return 'stormy';
  return 'partly_cloudy';
}

function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    sunny: 'sunny',
    partly_cloudy: 'partly cloudy',
    cloudy: 'cloudy',
    rainy: 'rainy',
    snowy: 'snowy',
    windy: 'windy',
    stormy: 'stormy',
  };
  return labels[condition] ?? 'partly cloudy';
}

function feelsLikeLabel(tempF: number): string {
  if (tempF >= 85) return 'warm';
  if (tempF >= 65) return 'mild';
  if (tempF >= 48) return 'cool';
  if (tempF >= 32) return 'cold';
  return 'freezing';
}

// ─── Main fetch ────────────────────────────────────────────────────────────────

export async function getWeatherForCity(city: string): Promise<WeatherContext | null> {
  if (!city?.trim()) return null;

  const cached = getCached(city);
  if (cached) return cached;

  const coords = await geocodeCity(city);
  if (!coords) return null;

  try {
    const params = new URLSearchParams({
      latitude: coords.lat.toString(),
      longitude: coords.lon.toString(),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      temperature_unit: 'celsius',
      wind_speed_unit: 'mph',
      timezone: 'auto',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };

    const cur = data.current;
    if (!cur) return null;

    const tempC = Math.round(cur.temperature_2m ?? 15);
    const tempF = Math.round((tempC * 9) / 5 + 32);
    const condition = wmoToCondition(cur.weather_code ?? 0);
    const feelsLike = feelsLikeLabel(tempF);

    const description = `${tempF}°F (${tempC}°C), ${conditionLabel(condition)}`;

    const promptText = [
      `Current weather in ${city}: ${description}.`,
      `Condition feels ${feelsLike}.`,
      `Consider how this affects layering, fabric choice, and footwear appropriateness.`,
    ].join(' ');

    const result: WeatherContext = {
      city,
      tempCelsius: tempC,
      tempFahrenheit: tempF,
      condition,
      description,
      promptText,
      feelsLike,
    };

    setCached(city, result);
    return result;
  } catch (err) {
    console.warn('[WeatherService] Forecast fetch failed for', city, err);
    return null;
  }
}

/** Returns a short weather summary for push notification copy */
export function getWeatherNudgeCopy(weather: WeatherContext): { prefix: string; context: string } {
  const tempStr = `${weather.tempFahrenheit}°F`;

  if (weather.condition === 'rainy') {
    return {
      prefix: `It's ${tempStr} and rainy today`,
      context: 'Your layered looks score highest in wet weather.',
    };
  }
  if (weather.condition === 'snowy') {
    return {
      prefix: `${tempStr} and snowy today`,
      context: 'Your cold-weather outfits are built for this.',
    };
  }
  if (weather.feelsLike === 'warm') {
    return {
      prefix: `It's ${tempStr} and sunny`,
      context: 'Perfect for your lighter, higher-scoring looks.',
    };
  }
  if (weather.feelsLike === 'cold' || weather.feelsLike === 'freezing') {
    return {
      prefix: `It's ${tempStr} out`,
      context: 'Time to layer — your cold-weather fits score strong.',
    };
  }
  return {
    prefix: `${tempStr} today in ${weather.city}`,
    context: 'Great conditions for any of your top-scoring looks.',
  };
}
