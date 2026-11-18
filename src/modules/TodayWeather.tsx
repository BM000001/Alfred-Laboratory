import { useEffect, useState } from 'react';
import { getAlfredLocalStorageKey } from '../storage/namespace';
import { EditDialog } from '../components/EditDialog';

type Place = { latitude: number; longitude: number; name: string };
type Forecast = { temperature: number; low: number; high: number; code: number };
const cityKey = getAlfredLocalStorageKey('alfred-weather-city');

function weatherText(code: number) {
  if (code === 0) return 'Céu limpo';
  if (code <= 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 48) return 'Neblina';
  if (code <= 57) return 'Garoa';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Chuva';
  if (code <= 86) return 'Neve';
  if (code >= 95) return 'Trovoadas';
  return 'Condição variável';
}

export function TodayWeather() {
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem(cityKey) ?? ''; } catch { return ''; }
  });
  const [draft, setDraft] = useState('');
  const [edit, setEdit] = useState(false);
  const [position, setPosition] = useState<Place>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [forecast, setForecast] = useState<{ name: string; weather: Forecast }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!position && !city) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setForecast(undefined);
      try {
        let place = position;
        if (!place) {
          const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`, { signal: controller.signal });
          if (!response.ok) throw new Error('A busca por cidade está indisponível.');
          const result = await response.json();
          place = result.results?.[0];
          if (!place) throw new Error('Cidade não encontrada.');
        }
        const query = new URLSearchParams({
          latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,weather_code',
          daily: 'temperature_2m_min,temperature_2m_max', timezone: 'auto', forecast_days: '1',
        });
        const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, { signal: controller.signal });
        if (!response.ok) throw new Error('Não foi possível consultar a previsão.');
        const result = await response.json();
        const values = [result.current?.temperature_2m, result.daily?.temperature_2m_min?.[0], result.daily?.temperature_2m_max?.[0], result.current?.weather_code];
        if (!values.every(Number.isFinite)) throw new Error('A previsão veio incompleta. Tente novamente mais tarde.');
        const [temperature, low, high, code] = values.map(Math.round);
        if (!controller.signal.aborted) setForecast({ name: place.name, weather: { temperature, low, high, code } });
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Previsão indisponível.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [position, city]);

  function locate() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Este navegador não fornece localização. Você pode consultar pela cidade.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      setPosition({ latitude: Number(coords.latitude.toFixed(2)), longitude: Number(coords.longitude.toFixed(2)), name: 'Sua região' });
    }, (cause) => {
      setLocating(false);
      setLocationError(cause.code === 1 ? 'A localização não foi autorizada. Você pode consultar pela cidade.' : 'Não foi possível localizar seu dispositivo.');
    }, { maximumAge: 900_000, timeout: 10_000 });
  }

  return <div className="today-weather">
    {forecast && <p><strong>{forecast.weather.temperature}° · {weatherText(forecast.weather.code)}</strong><small>{forecast.name} · {forecast.weather.low}° a {forecast.weather.high}°</small></p>}
    {loading || locating ? <p role="status">Consultando o tempo…</p> : <>
      <button className="text-action" type="button" onClick={locate}>{forecast ? 'Atualizar pela localização' : 'Consultar tempo local'}</button>
      <button className="text-action" type="button" onClick={() => { setDraft(city); setEdit(true); }}>Usar cidade</button>
    </>}
    {locationError && <p role="status">{locationError}</p>}
    {error && <p role="status">{error}</p>}
    {edit && <EditDialog title="Previsão por cidade" onClose={() => setEdit(false)}>
      <form className="dialog-form" onSubmit={(event) => {
        event.preventDefault();
        const value = draft.trim();
        if (!value) return;
        try { localStorage.setItem(cityKey, value); } catch { /* Consulta disponível nesta sessão. */ }
        setPosition(undefined); setCity(value); setEdit(false);
      }}>
        <label htmlFor="weather-city">Cidade</label><input id="weather-city" required maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button className="primary-action" type="submit">Consultar</button>
      </form>
    </EditDialog>}
  </div>;
}
