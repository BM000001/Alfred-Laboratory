import { useCallback, useEffect, useRef, useState } from 'react';
import { getAlfredLocalStorageKey } from '../storage/namespace';
import { EditDialog } from '../components/EditDialog';
import { fetchForecast, forgetLocalForecast, FORECAST_TTL, readForecast, storeForecast, type SavedForecast, type WeatherSource } from './todayWeatherData';

const cityKey = getAlfredLocalStorageKey('alfred-weather-city');
const modeKey = getAlfredLocalStorageKey('weather-mode');
type Mode = 'local' | 'city' | 'denied' | 'idle';
const localSource = { kind: 'local' } as const;

function initialPreference(): { mode: Mode; city: string } {
  try {
    const city = localStorage.getItem(cityKey) ?? '';
    const mode = localStorage.getItem(modeKey);
    if (mode === 'local' || mode === 'denied') return { city, mode };
    return { city, mode: city ? 'city' : 'idle' };
  } catch { return { city: '', mode: 'idle' }; }
}

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
  const [initial] = useState(initialPreference);
  const [mode, setMode] = useState(initial.mode);
  const [city, setCity] = useState(initial.city);
  const [draft, setDraft] = useState('');
  const [edit, setEdit] = useState(false);
  const [forecast, setForecast] = useState<SavedForecast>();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);

  const rememberMode = useCallback((value: Mode) => {
    setMode(value);
    try { localStorage.setItem(modeKey, value); } catch { /* Preferência disponível nesta sessão. */ }
  }, []);

  const denyLocation = useCallback(() => {
    rememberMode('denied');
    forgetLocalForecast();
    setForecast(undefined);
    setNotice('A localização não foi autorizada. Você pode consultar pela cidade.');
  }, [rememberMode]);

  const load = useCallback(async (source: WeatherSource, manual: boolean, signal: AbortSignal) => {
    setLoading(true);
    setNotice('');
    const cached = readForecast(source);
    try {
      if (!manual && source.kind === 'local') {
        // Em navegadores sem Permissions API, usar somente o cache até um gesto explícito.
        const permission = await navigator.permissions?.query?.({ name: 'geolocation' }).catch(() => undefined);
        if (signal.aborted) return;
        if (permission?.state === 'denied') { denyLocation(); return; }
        if (permission?.state !== 'granted') {
          setForecast(permission ? undefined : cached);
          if (permission || !cached || Date.now() - cached.savedAt >= FORECAST_TTL) {
            setNotice('Toque em Atualizar para confirmar a localização neste navegador.');
          }
          return;
        }
      }
      if (!manual && cached && Date.now() - cached.savedAt < FORECAST_TTL) {
        setForecast(cached);
        return;
      }

      setForecast(cached);
      const updated = await fetchForecast(source, signal, manual);
      if (signal.aborted) return;
      storeForecast(updated);
      setForecast(updated);
    } catch (cause) {
      if (signal.aborted) return;
      if (source.kind === 'local' && typeof cause === 'object' && cause && 'code' in cause && cause.code === 1) {
        denyLocation();
        return;
      }
      if (cause instanceof TypeError) setNotice('Não foi possível conectar ao serviço de previsão. Tente atualizar.');
      else setNotice(cause instanceof Error ? cause.message : 'Não foi possível obter a localização. Tente atualizar ou consulte pela cidade.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [denyLocation]);

  const start = useCallback((source: WeatherSource, manual: boolean) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    void load(source, manual, controller.signal);
  }, [load]);

  useEffect(() => {
    if (initial.mode === 'local') start(localSource, false);
    else if (initial.mode === 'city') start({ kind: 'city', city: initial.city }, false);
    else if (initial.mode === 'denied') setNotice('A localização não foi autorizada. Você pode consultar pela cidade.');
    return () => request.current?.abort();
  }, [initial, start]);

  function activateLocation() {
    rememberMode('local');
    start(localSource, true);
  }

  function selectCity() {
    const value = draft.trim();
    if (!value) return;
    try { localStorage.setItem(cityKey, value); } catch { /* Consulta disponível nesta sessão. */ }
    setCity(value);
    rememberMode('city');
    setEdit(false);
    start({ kind: 'city', city: value }, true);
  }

  const weather = forecast?.weather;
  const current = weather && [weather.temperature !== undefined ? `${weather.temperature}°` : undefined,
    weather.code !== undefined ? weatherText(weather.code) : undefined].filter(Boolean).join(' · ');
  const range = weather && [weather.low !== undefined ? `Mín. ${weather.low}°` : undefined,
    weather.high !== undefined ? `Máx. ${weather.high}°` : undefined].filter(Boolean).join(' · ');

  return <div className="today-weather" aria-label="Previsão do tempo">
    {forecast && <p>{current && <strong>{current}</strong>}
      <small>{[forecast.name, range].filter(Boolean).join(' · ')}</small>
      {Date.now() - forecast.savedAt >= FORECAST_TTL && <small>Última previsão salva</small>}
    </p>}
    {mode === 'idle' && <small>Ative a previsão para consultar sua região no Open-Meteo.</small>}
    {loading ? <p role="status">Consultando o tempo…</p> : <div className="weather-actions">
      {mode === 'local' && <button className="text-action" type="button" onClick={() => start(localSource, true)}>Atualizar previsão</button>}
      {mode === 'city' && <button className="text-action" type="button" onClick={() => start({ kind: 'city', city }, true)}>Atualizar previsão</button>}
      {(mode === 'idle' || mode === 'city') && <button className="text-action" type="button" onClick={activateLocation}>Ativar previsão local</button>}
      <button className="text-action" type="button" onClick={() => { setDraft(city); setEdit(true); }}>{mode === 'city' ? 'Alterar cidade' : 'Usar cidade'}</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
    {edit && <EditDialog title="Previsão por cidade" onClose={() => setEdit(false)}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); selectCity(); }}>
        <label htmlFor="weather-city">Cidade</label><input id="weather-city" required maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button className="primary-action" type="submit">Consultar</button>
      </form>
    </EditDialog>}
  </div>;
}
