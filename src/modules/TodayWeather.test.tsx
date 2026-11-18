import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TodayWeather } from './TodayWeather';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('consulta a localização uma vez por ação e exibe somente dados retornados', async () => {
  const locate = vi.fn((success) => success({ coords: { latitude: -23.1234, longitude: -46.9876 } }));
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: locate } });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    current: { temperature_2m: 24, weather_code: 3 },
    daily: { temperature_2m_min: [18], temperature_2m_max: [26] },
  })));
  vi.stubGlobal('fetch', fetcher);
  render(<TodayWeather />);
  expect(locate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar tempo local' }));
  expect(await screen.findByText('24° · Nublado')).toBeVisible();
  expect(locate).toHaveBeenCalledTimes(1);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('latitude')).toBe('-23.12');
  expect(url.searchParams.get('longitude')).toBe('-46.99');
});

it('permite consultar pela cidade se a localização for negada', async () => {
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (_success: unknown, fail: (error: { code: number }) => void) => fail({ code: 1 }) } });
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<TodayWeather />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar tempo local' }));
  expect(await screen.findByText(/localização não foi autorizada/)).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Usar cidade' }));
  expect(screen.getByRole('dialog', { name: 'Previsão por cidade' })).toBeVisible();
});
