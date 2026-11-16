import { useEffect, useRef, useState } from 'react';
import { createGoogleCalendarClient, loadGoogleIdentity, type GoogleCalendar } from './agenda/googleCalendar';
import { createAgendaService } from './agenda/agendaService';
import { appointmentRepository } from '../storage/repositories';

const client = createGoogleCalendarClient();
const agenda = createAgendaService(appointmentRepository);
const configuredClientId: string = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID ?? '';
let sessionClientId = configuredClientId;

export function GoogleCalendarOAuthPanel({ onImported }: { onImported: () => Promise<void> }) {
  const [clientId, setClientId] = useState(() => sessionClientId);
  const [identityReady, setIdentityReady] = useState(Boolean(window.google?.accounts.oauth2));
  const [connected, setConnected] = useState(client.connected());
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Não foi possível acessar o Google Agenda.');
    } finally {
      inFlight.current = false;
      if (active.current) { setBusy(false); setConnected(client.connected()); }
    }
  }
  async function listCalendars() {
    const available = await client.calendars();
    if (!active.current) return;
    setCalendars(available);
    setSelected(current => current.filter(id => available.some(calendar => calendar.id === id)));
    setMessage(available.length ? 'Escolha os calendários e toque em “Sincronizar selecionados”.' : 'Nenhum calendário disponível para leitura.');
  }
  async function synchronize() {
    const snapshot = await client.snapshot(calendars.filter(calendar => selected.includes(calendar.id)));
    // Read and validate every selected calendar before changing local records.
    if (!active.current) return;
    for (const event of snapshot.events) await agenda.upsertImported(event);
    let archived = 0;
    for (const calendarId of snapshot.calendarIds) {
      archived += await agenda.reconcileImportedCalendar(calendarId, snapshot.events.filter(event => event.importedCalendarId === calendarId).map(event => event.importedUid), snapshot.from, snapshot.to);
    }
    await onImported();
    if (active.current) {
      setLastSync(new Date().toISOString());
      setMessage(`${snapshot.events.length} evento(s) sincronizado(s); ${archived} removido(s) da origem foram arquivados. Compromissos manuais e Apple foram preservados.`);
    }
  }
  async function disconnect() {
    setCalendars([]); setSelected([]); setLastSync(null);
    await client.disconnect();
    if (active.current) setMessage('Google desconectado. Os eventos já importados foram mantidos na Agenda.');
  }

  return <section className="entry-panel apple-calendar-panel" aria-labelledby="google-calendar-title">
    <div className="apple-calendar-heading"><div><span className="card-label">INTEGRAÇÃO COM GOOGLE</span><h3 id="google-calendar-title">Google Calendar</h3></div><span>{connected ? 'Sessão conectada' : 'Desconectado'}</span></div>
    <p>Conexão direta por OAuth, somente leitura. Traga os próximos 90 dias de eventos, incluindo hoje. O Alfred consulta o Google com sua autorização e salva os eventos neste aparelho. Não cria nem altera eventos no Google.</p>
    <p className="apple-calendar-note">Alterações feitas aqui nos eventos importados afetam apenas a cópia local e podem ser substituídas na próxima sincronização.</p>
    <p className="apple-calendar-note">A conexão funciona enquanto esta página estiver aberta e a autorização estiver válida. Ao recarregar ou quando a sessão expirar, conecte novamente. Os eventos importados continuam disponíveis.</p>
    {!configuredClientId && <details><summary>Configurar conexão Google</summary>
      <p>Informe o Client ID público de um aplicativo web com a Google Calendar API habilitada. Não informe senha, token ou Client Secret.</p>
      <label className="field-label" htmlFor="google-calendar-client-id">Client ID público</label>
      <input id="google-calendar-client-id" value={clientId} disabled={busy || connected} onChange={event => setClientId(event.target.value)} placeholder="…apps.googleusercontent.com" autoComplete="off" />
    </details>}
    <div className="apple-calendar-actions">
      <button className="primary-action" type="button" disabled={busy || !clientId.trim()} onClick={() => void run(async () => {
        if (!identityReady) {
          await loadGoogleIdentity();
          if (active.current) { setIdentityReady(true); setMessage('Conexão preparada. Toque em “Continuar com Google” para abrir a autorização.'); }
          return;
        }
        if (!client.connected()) {
          await client.connect(clientId);
          sessionClientId = clientId;
        }
        await listCalendars();
      })}>{busy ? 'Aguarde...' : connected ? 'Atualizar lista de calendários' : identityReady ? 'Continuar com Google' : 'Conectar Google Agenda'}</button>
      {connected && <>
        <button className="text-action" type="button" disabled={busy || !selected.length} onClick={() => void run(synchronize)}>Sincronizar selecionados</button>
        <button className="text-action" type="button" disabled={busy} onClick={() => void run(disconnect)}>Desconectar Google</button>
      </>}
    </div>
    {connected && calendars.length > 0 && <fieldset disabled={busy} className="apple-calendar-picker"><legend>Escolha os calendários para importar</legend>
      {calendars.map(calendar => <label className="apple-calendar-option" key={calendar.id}>
        <input type="checkbox" checked={selected.includes(calendar.id)} onChange={event => setSelected(current => event.target.checked ? [...current, calendar.id] : current.filter(id => id !== calendar.id))} />
        <span>{calendar.summary}{calendar.primary ? ' · Principal' : ''}</span>
      </label>)}
    </fieldset>}
    {lastSync && <small>Última sincronização Google: {new Date(lastSync).toLocaleString('pt-BR')}</small>}
    {message && <p className="module-feedback" role="status">{message}</p>}
    {error && <p className="module-error" role="alert">{error}</p>}
  </section>;
}
