import { Injectable } from '@angular/core';
import { WeatherDay, WeatherSnapshot } from './models';

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
}

const UNKNOWN_CONDITION = { icon: 'fa-solid fa-cloud', label: 'Unbekannt' };
const FORECAST_DAYS = 5;
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const WEATHER_CODE_MAP: Record<number, { icon: string; label: string }> = {
  0: { icon: 'fa-solid fa-sun', label: 'Klar' },
  1: { icon: 'fa-solid fa-cloud-sun', label: 'Überwiegend klar' },
  2: { icon: 'fa-solid fa-cloud-sun', label: 'Teilweise bewölkt' },
  3: { icon: 'fa-solid fa-cloud', label: 'Bedeckt' },
  45: { icon: 'fa-solid fa-smog', label: 'Nebel' },
  48: { icon: 'fa-solid fa-smog', label: 'Nebel' },
  51: { icon: 'fa-solid fa-cloud-rain', label: 'Leichter Nieselregen' },
  53: { icon: 'fa-solid fa-cloud-rain', label: 'Nieselregen' },
  55: { icon: 'fa-solid fa-cloud-rain', label: 'Starker Nieselregen' },
  61: { icon: 'fa-solid fa-cloud-rain', label: 'Leichter Regen' },
  63: { icon: 'fa-solid fa-cloud-rain', label: 'Regen' },
  65: { icon: 'fa-solid fa-cloud-rain', label: 'Starker Regen' },
  67: { icon: 'fa-solid fa-cloud-rain', label: 'Gefrierender Regen' },
  71: { icon: 'fa-solid fa-snowflake', label: 'Leichter Schneefall' },
  73: { icon: 'fa-solid fa-snowflake', label: 'Schneefall' },
  75: { icon: 'fa-solid fa-snowflake', label: 'Starker Schneefall' },
  77: { icon: 'fa-solid fa-snowflake', label: 'Schneegriesel' },
  80: { icon: 'fa-solid fa-cloud-showers-heavy', label: 'Leichte Schauer' },
  81: { icon: 'fa-solid fa-cloud-showers-heavy', label: 'Schauer' },
  82: { icon: 'fa-solid fa-cloud-showers-heavy', label: 'Heftige Schauer' },
  95: { icon: 'fa-solid fa-bolt', label: 'Gewitter' },
  96: { icon: 'fa-solid fa-bolt', label: 'Gewitter mit Hagel' },
  99: { icon: 'fa-solid fa-bolt', label: 'Schweres Gewitter mit Hagel' },
};

@Injectable({ providedIn: 'root' })
export class WeatherService {
  async geocode(query: string): Promise<GeocodeResult | null> {
    const name = query.trim();
    if (!name) return null;
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(name)}`,
      );
      if (!response.ok) return null;
      const data = await response.json();
      const result = data?.results?.[0];
      if (!result) return null;
      const label = [result.name, result.country].filter(Boolean).join(', ');
      return { name: label, lat: result.latitude, lon: result.longitude };
    } catch {
      return null;
    }
  }

  async getForecast(lat: number, lon: number): Promise<WeatherSnapshot | null> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=${FORECAST_DAYS}&timezone=auto`,
      );
      if (!response.ok) return null;
      const data = await response.json();
      const current = data?.current;
      if (typeof current?.temperature_2m !== 'number') return null;
      const condition = WEATHER_CODE_MAP[current.weather_code] ?? UNKNOWN_CONDITION;
      return {
        temperatureC: Math.round(current.temperature_2m),
        ...condition,
        daily: this.parseDaily(data?.daily),
      };
    } catch {
      return null;
    }
  }

  private parseDaily(daily: unknown): WeatherDay[] {
    const d = daily as
      | {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
        }
      | undefined;
    if (!d?.time) return [];
    return d.time.map((date, index) => ({
      weekday: WEEKDAY_LABELS[new Date(date).getUTCDay()],
      maxC: Math.round(d.temperature_2m_max?.[index] ?? 0),
      minC: Math.round(d.temperature_2m_min?.[index] ?? 0),
      ...(WEATHER_CODE_MAP[d.weather_code?.[index] ?? -1] ?? UNKNOWN_CONDITION),
    }));
  }
}
