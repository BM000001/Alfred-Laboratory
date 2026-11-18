import { getAlfredLocalStorageKey } from '../storage/namespace';

export type WeatherSource = { kind: 'local' } | { kind: 'city'; city: string };
type Forecast = { temperature?: number; low?: number; high?: number; code?: number };
export type SavedForecast = { source: string; savedAt: number; name: string; weather: Forecast };

const cacheKey = getAlfredLocalStorageKey('weather-forecast-v1');
export const FORECAST_TTL = 30 * 60_000;
const STALE_LIMIT = 24 * 60 * 60_000;
const sourceKey = (source: WeatherSource) => source.kind === 'local' ? 'local' : 'city:' + source.city.toLocaleLowerCase('pt-BR');
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const rounded = (value: unknown) => isNumber(value) ? Math.round(value) : undefined;

export function readForecast(source: WeatherSource, now = Date.now()): SavedForecast | undefined {
  try {
    const record = JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as SavedForecast | null;
    if (record?.source !== sourceKey(source) || typeof record.name !== 'string' || !isNumber(record.savedAt)) return;
    const age = now - record.savedAt;
    if (age < 0 || age >= STALE_LIMIT || !hasWeather(record.weather)) return;
    return record;
  } catch { return undefined; }
}

function hasWeather(value: unknown): value is Forecast {
  if (!value || typeof value !== 'object') return false;
  const values = ['temperature', 'code', 'low', 'high'].map((key) => (value as Record<string, unknown>)[key]);
  return values.some(isNumber) && values.every((field) => field === undefined || isNumber(field));
}

export function storeForecast(record: SavedForecast) {
  try { localStorage.setItem(cacheKey, JSON.stringify(record)); } catch { /* A previsão atual continua visível. */ }
}

export function forgetLocalForecast() {
  try {
    if (readForecast({ kind: 'local' })) localStorage.removeItem(cacheKey);
  } catch { /* O navegador pode restringir o armazenamento. */ }
}

export function getPosition(signal: AbortSignal, manual: boolean): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    if (!navigator.geolocation) { reject(new Error('A localização não está disponível neste navegador.')); return; }
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      signal.removeEventListener('abort', abort);
      resolve(coords);
    }, (error) => {
      signal.removeEventListener('abort', abort);
      reject(error);
    }, { maximumAge: manual ? 0 : FORECAST_TTL, timeout: 10_000 });
  });
}

export async function fetchForecast(source: WeatherSource, signal: AbortSignal, manual: boolean): Promise<SavedForecast> {
  let latitude: number;
  let longitude: number;
  let name: string;
  if (source.kind === 'local') {
    const coords = await getPosition(signal, manual);
    latitude = Number(coords.latitude.toFixed(2));
    longitude = Number(coords.longitude.toFixed(2));
    name = 'Sua região';
  } else {
    const query = new URLSearchParams({ name: source.city, count: '1', language: 'pt', format: 'json' });
    const response = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + query, { signal });
    if (!response.ok) throw new Error('A busca por cidade está indisponível.');
    const result = (await response.json()).results?.[0];
    if (!isNumber(result?.latitude) || !isNumber(result?.longitude) || typeof result.name !== 'string') {
      throw new Error('Cidade não encontrada.');
    }
    ({ latitude, longitude, name } = result);
  }

  const query = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_min,temperature_2m_max', timezone: 'auto', forecast_days: '1',
  });
  const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível consultar a previsão.');
  const result = await response.json();
  const weather = {
    temperature: rounded(result.current?.temperature_2m),
    code: rounded(result.current?.weather_code),
    low: rounded(result.daily?.temperature_2m_min?.[0]),
    high: rounded(result.daily?.temperature_2m_max?.[0]),
  };
  if (!hasWeather(weather)) throw new Error('A previsão veio sem dados. Tente novamente mais tarde.');
  return { source: sourceKey(source), name, savedAt: Date.now(), weather };
}
