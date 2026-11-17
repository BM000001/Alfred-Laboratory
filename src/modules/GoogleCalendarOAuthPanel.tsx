import { useEffect, useRef, useState } from 'react';
import { createGoogleCalendarClient, loadGoogleIdentity, type GoogleCalendar, type GoogleImportedEvent } from './agenda/googleCalendar';
import { createAgendaService } from './agenda/agendaService';
import { appointmentRepository } from '../storage/repositories';
import { getAlfredLocalStorageKey } from '../storage/storageKeys';

const client = createGoogleCalendarClient();
const agenda = createAgendaService(appointmentRepository);
const configuredClientId: string = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID ?? '';
let sessionClientId = configuredClientId;

export function GoogleCalendarOAuthPanel({ onImported }: { onImported: () => Promise<void> }) {
  const [clientId, setClientId] = useState(() => sessionClientId);
  const [identityReady, setIdentityReady] = useState(Boolean(window.google?.accounts.oauth2));
  const [connected, setConnected] = useState(client.connected());
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(getAlfredLocalStorageKey('alfred.googleCalendarIds')) ?? '[]');
      return Array.isArray(stored) && stored.every((id): id is string => typeof id === 'string') ? stored : [];
    } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [writeEnabled, setWriteEnabled] = useState(client.canWrite());
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventId, setEventId] = useState('');
  const [syncedEvents, setSyncedEvents] = useState<GoogleImportedEvent[]>([]);
  const [targetCalendar, setTargetCalendar] = useState('');
  const lastAttempt = useRef(0);
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    window.localStorage.setItem(getAlfredLocalStorageKey('alfred.googleCalendarIds'), JSON.stringify(selected));
  }, [selected]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Não foi possível acessar o Google Agenda.');
    } finally {
      inFlight.current = false;
      if (active.current) { setBusy(false); setConnected(client.connected()); setWriteEnabled(client.canWrite()); }
    }
  }
  async function listCalendars() {
    const available = await client.calendars();
    if (!active.current) return;
    setCalendars(available);
    setTargetCalendar(current => available.some(calendar => calendar.id === current) ? current : (available[0]?.id ?? ''));
    setSelected(current => current.filter(id => available.some(calendar => calendar.id === id)));
    setMessage(available.length ? 'Escolha os calendários e toque em “Sincronizar selecionados”.' : 'Nenhum calendário disponível para leitura.');
  }
  async function synchronize() {
    lastAttempt.current = Date.now();
    const snapshot = await client.snapshot(calendars.filter(calendar => selected.includes(calendar.id)));
    // Read and validate every selected calendar before changing local records.
    if (!active.current) return;
    setSyncedEvents(snapshot.events);
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
  // Poll only while the page is visible, a token is valid and a calendar has been
  // successfully imported once. Never open OAuth popups from an interval or persist tokens.
  useEffect(() => {
    if (!autoSync || !lastSync || !connected || !selected.length) return;
    const refreshIfDue = () => {
      if (document.visibilityState !== 'visible' || !client.connected()) return;
      if (Date.now() - lastAttempt.current < 5 * 60_000) return;
      void run(synchronize);
    };
    const timer = window.setInterval(refreshIfDue, 60_000);
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
    };
  }, [autoSync, connected, lastSync, selected, calendars]);

  async function disconnect() {
    window.localStorage.removeItem(getAlfredLocalStorageKey('alfred.googleCalendarIds'));
    setCalendars([]); setSelected([]); setSyncedEvents([]); setLastSync(null); setWriteEnabled(false); lastAttempt.current = 0;
    await client.disconnect();
    if (active.current) setMessage('Google desconectado. Os eventos já importados foram mantidos na Agenda.');
  }

  return <section className="entry-panel apple-calendar-panel" aria-labelledby="google-calendar-title">
    <div className="apple-calendar-heading"><div><span className="card-label">INTEGRAÇÃO COM GOOGLE</span><h3 id="google-calendar-title">Google Calendar</h3></div><span>{connected ? 'Sessão conectada' : 'Desconectado'}</span></div>
    <p>Conexão inicial somente leitura: importa os próximos 90 dias. Criar e editar eventos no Google exige uma autorização adicional, separada e opcional.</p>
    <p className="apple-calendar-note">Alterações na Agenda local não são enviadas automaticamente ao Google. Apenas as ações explícitas abaixo podem criar ou editar eventos na conta Google.</p>
    <p className="apple-calendar-note">Ao recarregar, conecte novamente pelo botão Google. Sua seleção de calendários fica salva neste dispositivo, mas o token de acesso não. Os eventos já importados continuam disponíveis.</p>
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
    {connected && <label className="apple-calendar-option"><input type="checkbox" checked={autoSync} onChange={event => setAutoSync(event.target.checked)} /> Atualizar automaticamente enquanto o Alfred estiver aberto (a cada 5 minutos, após a primeira sincronização)</label>}
    {connected && <details><summary>Gerenciar eventos no Google (opcional)</summary>
      <p className="apple-calendar-note">Acesso de edição é opcional. Antes de enviar, confira o calendário, título e horários. Não há exclusão automática.</p>
      {!writeEnabled && <button type="button" className="text-action" disabled={busy} onClick={() => void run(async () => {
        await client.connect(clientId, true);
        await listCalendars();
        setMessage('Permissão de edição concedida. Escolha o calendário e confirme cada operação.');
      })}>Autorizar criação e edição no Google</button>}
      {writeEnabled && <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (!targetCalendar) throw new Error('Escolha um calendário.');
        if (!window.confirm(eventId.trim() ? 'Confirmar alteração deste evento no Google Calendar?' : 'Confirmar criação de evento no Google Calendar?')) return;
        const changes = { title: eventTitle, startsAt: eventStart, endsAt: eventEnd };
        if (eventId.trim()) {
          const chosen = syncedEvents.find(item => item.importedUid === eventId);
          if (!chosen) throw new Error('Sincronize novamente e selecione o evento a editar.');
          const sourceCalendar = chosen.importedCalendarId.slice('google:'.length);
          if (targetCalendar !== sourceCalendar) throw new Error('Para editar, mantenha o calendário de origem do evento.');
          const actualId = decodeURIComponent(chosen.importedUid.split(':').slice(2).join(':'));
          await client.updateEvent(sourceCalendar, actualId, changes);
        }
        else await client.createEvent(targetCalendar, changes);
        setEventId(''); setEventTitle(''); setEventStart(''); setEventEnd('');
        setMessage('Operação concluída no Google. Sincronize os calendários selecionados para atualizar a cópia local.');
      }); }}>
        <label className="field-label" htmlFor="google-write-calendar">Calendário de destino</label>
        <select id="google-write-calendar" value={targetCalendar} onChange={event => setTargetCalendar(event.target.value)} required>{calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.summary}</option>)}</select>
        <label className="field-label" htmlFor="google-write-event-id">Evento existente (opcional; selecione para editar)</label>
        <select id="google-write-event-id" value={eventId} onChange={event => {
          const selectedEvent = syncedEvents.find(item => item.importedUid === event.target.value);
          setEventId(event.target.value);
          if (selectedEvent) {
            setTargetCalendar(selectedEvent.importedCalendarId.slice('google:'.length));
            setEventTitle(selectedEvent.title);
            const toLocal = (iso: string) => { const d = new Date(iso); const offset = d.getTimezoneOffset() * 60_000; return new Date(d.getTime() - offset).toISOString().slice(0, 16); };
            setEventStart(toLocal(selectedEvent.startsAt)); setEventEnd(toLocal(selectedEvent.endsAt));
          }
        }}><option value="">Criar novo evento</option>{syncedEvents.filter(item => !item.isRecurring && !item.isAllDay).map(item => <option key={item.importedUid} value={item.importedUid}>{item.title} · {new Date(item.startsAt).toLocaleString('pt-BR')}</option>)}</select>
        <label className="field-label" htmlFor="google-write-title">Título</label>
        <input id="google-write-title" value={eventTitle} onChange={event => setEventTitle(event.target.value)} required maxLength={120} />
        <label className="field-label" htmlFor="google-write-start">Início</label>
        <input id="google-write-start" type="datetime-local" value={eventStart} onChange={event => setEventStart(event.target.value)} required />
        <label className="field-label" htmlFor="google-write-end">Fim</label>
        <input id="google-write-end" type="datetime-local" value={eventEnd} onChange={event => setEventEnd(event.target.value)} required />
        <button type="submit" className="primary-action" disabled={busy || !calendars.length}>{eventId.trim() ? 'Confirmar edição no Google' : 'Criar evento no Google'}</button>
      </form>}
    </details>}
    {lastSync && <small>Última sincronização Google: {new Date(lastSync).toLocaleString('pt-BR')}</small>}
    <p className="apple-calendar-note">A atualização automática funciona apenas com a página visível e a sessão Google válida. Ao reabrir o Alfred, reconecte-se e sincronize uma vez para reativá-la. Não funciona com o app fechado.</p>
    {message && <p className="module-feedback" role="status">{message}</p>}
    {error && <p className="module-error" role="alert">{error}</p>}
  </section>;
}
