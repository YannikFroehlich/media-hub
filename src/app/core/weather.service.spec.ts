import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from './weather.service';

function mockFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));
}

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(() => {
    service = TestBed.inject(WeatherService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('geocodes a city name', async () => {
    mockFetchOnce({
      results: [{ name: 'Berlin', country: 'Deutschland', latitude: 52.5, longitude: 13.4 }],
    });

    const result = await service.geocode('Berlin');

    expect(result).toEqual({ name: 'Berlin, Deutschland', lat: 52.5, lon: 13.4 });
  });

  it('returns null for an empty query', async () => {
    expect(await service.geocode('   ')).toBeNull();
  });

  it('returns null when geocoding finds no match', async () => {
    mockFetchOnce({ results: [] });

    expect(await service.geocode('asdkjhasd')).toBeNull();
  });

  it('returns null when the geocoding request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    expect(await service.geocode('Berlin')).toBeNull();
  });

  it('fetches the current forecast and maps the weather code to an icon', async () => {
    mockFetchOnce({ current: { temperature_2m: 18.4, weather_code: 95 } });

    const result = await service.getForecast(52.5, 13.4);

    expect(result).toEqual({ temperatureC: 18, icon: 'fa-solid fa-bolt', label: 'Gewitter' });
  });

  it('falls back to an unknown-condition icon for an unmapped weather code', async () => {
    mockFetchOnce({ current: { temperature_2m: 10, weather_code: -1 } });

    const result = await service.getForecast(52.5, 13.4);

    expect(result).toEqual({ temperatureC: 10, icon: 'fa-solid fa-cloud', label: 'Unbekannt' });
  });

  it('returns null when the forecast request fails', async () => {
    mockFetchOnce({}, false);

    expect(await service.getForecast(52.5, 13.4)).toBeNull();
  });
});
