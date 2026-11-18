import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TodayWeather } from './TodayWeather';
import { FORECAST_TTL } from './todayWeatherData';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const coords = { latitude: -23.1234, longitude: -46.9876 };
const forecast = (temperature: number) => new Response(JSON.stringify({
  current: { temperature_2m: temperature, weather_code: 3 },
  daily: { temperature_2m_min: [18], temperature_2m_max: [26] },
}));

function mockLocation(state: PermissionState = 'granted') {
  const locate = vi.fn((success, _fail, _options) => success({ coords }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate }, permissions: { query: vi.fn().mockResolvedValue({ state }) } });
  return locate;
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const activate = () => click('Ativar previsão local');

it('só acessa a localização após consentimento e guarda previsão sem coordenadas', async () => {
  const locate = mockLocation();
  const fetcher = vi.fn().mockResolvedValueOnce(forecast(24));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<TodayWeather />);
  expect(locate).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  activate();
  expect(await screen.findByText('24° · Nublado')).toBeVisible();
  expect(screen.getByText('Sua região · Mín. 18° · Máx. 26°')).toBeVisible();
  expect(locate).toHaveBeenCalledTimes(1);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('latitude')).toBe('-23.12');
  expect(url.searchParams.get('longitude')).toBe('-46.99');
  expect(JSON.stringify(localStorage)).not.toMatch(/latitude|longitude|23\.12|46\.99/);

  view.unmount();
  render(<TodayWeather />);
  expect(await screen.findByText('24° · Nublado')).toBeVisible();
  expect(locate).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('atualiza automaticamente o cache vencido e permite atualização manual com cache válido', async () => {
  const locate = mockLocation();
  const time = vi.spyOn(Date, 'now');
  time.mockReturnValue(1_000_000);
  const fetcher = vi.fn().mockResolvedValueOnce(forecast(24)).mockResolvedValueOnce(forecast(27)).mockResolvedValueOnce(forecast(29));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<TodayWeather />);
  activate();
  await screen.findByText('24° · Nublado');

  view.unmount();
  time.mockReturnValue(1_000_000 + FORECAST_TTL);
  render(<TodayWeather />);
  expect(await screen.findByText('27° · Nublado')).toBeVisible();
  expect(locate.mock.calls[1][2]).toMatchObject({ maximumAge: FORECAST_TTL });

  click('Atualizar previsão');
  expect(await screen.findByText('29° · Nublado')).toBeVisible();
  expect(locate.mock.calls[2][2]).toMatchObject({ maximumAge: 0 });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('respeita a recusa após reabrir e usa cidade somente por escolha', async () => {
  const locate = vi.fn((_success, fail) => fail({ code: 1 }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ name: 'Recife', latitude: -8, longitude: -34 }] })))
    .mockResolvedValueOnce(forecast(26));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<TodayWeather />);
  activate();
  expect(await screen.findByText(/localização não foi autorizada/)).toBeVisible();
  view.unmount();
  render(<TodayWeather />);
  await screen.findByText(/localização não foi autorizada/);
  expect(locate).toHaveBeenCalledTimes(1);
  expect(fetcher).not.toHaveBeenCalled();
  click('Usar cidade');
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Recife' } });
  click('Consultar');
  expect(await screen.findByText('26° · Nublado')).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('mantém a última previsão identificada quando a API falha com o cache vencido', async () => {
  mockLocation();
  const time = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const fetcher = vi.fn().mockResolvedValueOnce(forecast(24)).mockResolvedValueOnce(new Response('', { status: 502 }));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<TodayWeather />);
  activate();
  await screen.findByText('24° · Nublado');

  view.unmount();
  time.mockReturnValue(1_000_000 + FORECAST_TTL + 1);
  render(<TodayWeather />);
  expect(await screen.findByText('Não foi possível consultar a previsão.')).toBeVisible();
  expect(screen.getByText('24° · Nublado')).toBeVisible();
  expect(screen.getByText('Última previsão salva')).toBeVisible();
});

it('evita nova solicitação automática se o navegador exige confirmação ou não informa permissão', async () => {
  const locate = mockLocation();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ current: { temperature_2m: 24 } }))));
  const view = render(<TodayWeather />);
  activate();
  expect(await screen.findByText('24°')).toBeVisible();
  view.unmount();

  const withPrompt = mockLocation('prompt');
  const reopened = render(<TodayWeather />);
  expect(await screen.findByText(/Toque em Atualizar/)).toBeVisible();
  expect(screen.queryByText('24°')).not.toBeInTheDocument();
  expect(withPrompt).not.toHaveBeenCalled();
  reopened.unmount();

  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
  render(<TodayWeather />);
  await waitFor(() => expect(screen.getByText('24°')).toBeVisible());
  expect(locate).toHaveBeenCalledTimes(1);
});

it('descarta a previsão local quando o navegador revoga a autorização', async () => {
  mockLocation();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(forecast(24)));
  const view = render(<TodayWeather />);
  activate();
  await screen.findByText('24° · Nublado');
  view.unmount();

  const denied = mockLocation('denied');
  render(<TodayWeather />);
  expect(await screen.findByText(/localização não foi autorizada/)).toBeVisible();
  expect(screen.queryByText('24° · Nublado')).not.toBeInTheDocument();
  expect(denied).not.toHaveBeenCalled();
});
