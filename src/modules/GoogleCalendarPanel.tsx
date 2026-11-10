import { useEffect, useRef, useState } from 'react';
import type { Appointment } from './agenda/types';
import { getAlfredLocalStorageKey } from '../storage/namespace';
import { classifyImportedAppointment } from './agenda/agendaRules';
import { createAgendaService } from './agenda/agendaService';
import {
  beginGoogleCalendarConnection,
  clearGoogleCalendarSession,
  completeGoogleCalendarConnection,
  createGoogleEvent,
  deleteGoogleEvent,
  disconnectGoogleCalendar,
  getGoogleCalendarSession,
  isGoogleCalendarSessionActive,
  listGoogleCalendars,
  listGoogleEvents,
  updateGoogleEvent,
  type GoogleCalendarEvent,
  type GoogleCalendarInfo,
} from './agenda/googleCalendarApi';
import { appointmentRepository, calendarSyncRepository, pendingGoogleCalendarCreateRepository } from '../storage/repositories';

const agenda = createAgendaService(appointmentRepository);
const SYNC_WINDOW_PAST_DAYS = 90;
const SYNC_WINDOW_FUTURE_DAYS = 365;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function localDate(value: string): string {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function eventDate(value?: string, allDay = false): string | undefined {
  if (!value) return undefined;
  if (allDay) return new Date(value + 'T00:00:00').toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function toGoogleEvent(item: Appointment) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    summary: item.title,
    description: item.description ?? '',
    location: item.location ?? '',
    start: item.isAllDay
      ? { date: localDate(item.startsAt) }
      : { dateTime: item.startsAt, timeZone },
    end: item.isAllDay
      ? { date: localDate(item.endsAt) }
      : { dateTime: item.endsAt, timeZone },
  };
}

function isExpiredSyncCursor(error: unknown): boolean {
  return error instanceof Error && error.message.includes('HTTP 410');
}

export interface GoogleCalendarPanelProps {
  appointments: Appointment[];
  onChanged: () => Promise<void>;
}

export function GoogleCalendarPanel({ appointments, onChanged }: GoogleCalendarPanelProps) {
  const [connected, setConnected] = useState(isGoogleCalendarSessionActive());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionPreferencesAccountId, setSelectionPreferencesAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState('');
  const syncInFlight = useRef(false);

  function reportError(cause: unknown, fallback: string) {
    const message = cause instanceof Error ? cause.message : fallback;
    if (message.includes('HTTP 401') || message.includes('sessão expirou') ||
        message.includes('janela de conexão do Google') || message.includes('conexão com o Google foi encerrada')) {
      setConnected(false);
      setAccountId(null);
    }
    setError(message);
  }

  async function loadCalendars() {
    const loaded = await listGoogleCalendars();
    setCalendars(loaded);
    setSelectedIds((current) => {
      const valid = current.filter((id) => loaded.some((calendar) => calendar.id === id));
      if (valid.length) return valid;
      const primary = loaded.find((calendar) => calendar.primary);
      return primary ? [primary.id] : loaded.slice(0, 1).map((calendar) => calendar.id);
    });
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const completed = await completeGoogleCalendarConnection();
        if (!active) return;
        if (completed || isGoogleCalendarSessionActive()) {
          setConnected(true);
          const session = await getGoogleCalendarSession();
          setAccountId(session.accountId);
          await loadCalendars();
          if (active && completed) setMessage('Conta Google conectada. Selecione os calendários que deseja sincronizar.');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a conexão Google.');
        clearGoogleCalendarSession();
        setConnected(false);
        setAccountId(null);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!accountId) {
      setSelectedIds([]);
      setSelectionPreferencesAccountId(null);
      return;
    }
    setSelectionPreferencesAccountId(null);
    try {
      const saved = window.localStorage.getItem(getAlfredLocalStorageKey('alfred.googleCalendarIds:' + accountId));
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setSelectedIds(Array.isArray(parsed) && parsed.every((id): id is string => typeof id === 'string') ? parsed : []);
    } catch {
      setSelectedIds([]);
    }
    setSelectionPreferencesAccountId(accountId);
  }, [accountId]);

  useEffect(() => {
    if (accountId && selectionPreferencesAccountId === accountId) {
      window.localStorage.setItem(getAlfredLocalStorageKey('alfred.googleCalendarIds:' + accountId), JSON.stringify(selectedIds));
    }
  }, [accountId, selectedIds, selectionPreferencesAccountId]);

  async function syncCalendar(calendar: GoogleCalendarInfo): Promise<number> {
    if (!accountId) throw new Error('A conta Google não foi identificada. Reconecte antes de sincronizar.');
    const accountCalendarId = 'google:' + accountId + ':' + calendar.id;
    const stateId = accountCalendarId;
    const savedState = await calendarSyncRepository.getById(stateId);
    const from = new Date(Date.now() - SYNC_WINDOW_PAST_DAYS * 86400000);
    const to = new Date(Date.now() + SYNC_WINDOW_FUTURE_DAYS * 86400000);
    let syncToken = savedState?.syncToken;
    let fullSnapshot = !syncToken;

    async function fetchAll(useToken?: string) {
      const events: GoogleCalendarEvent[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;
      do {
        const page = await listGoogleEvents(calendar.id, useToken
          ? { syncToken: useToken, singleEvents: true, ...(pageToken ? { pageToken } : {}) }
          : {
              timeMin: from.toISOString(),
              timeMax: to.toISOString(),
              singleEvents: true,
              ...(pageToken ? { pageToken } : {}),
            });
        events.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
        nextSyncToken = page.nextSyncToken;
      } while (pageToken);
      return { events, nextSyncToken };
    }

    let result: Awaited<ReturnType<typeof fetchAll>>;
    try {
      result = await fetchAll(syncToken);
    } catch (cause) {
      if (!syncToken || !isExpiredSyncCursor(cause)) throw cause;
      syncToken = undefined;
      fullSnapshot = true;
      result = await fetchAll();
    }

    const seen: string[] = [];
    let imported = 0;
    const currentItems = await agenda.list();
    for (const event of result.events) {
      if (!event.id) throw new Error('Google retornou um evento sem identificador. A reconciliação foi interrompida.');
      const uid = accountCalendarId + ':' + event.id;
      if (event.status === 'cancelled') {
        const existing = currentItems.find((item) => item.externalProvider === 'google' &&
          item.externalAccountId === accountId && item.externalCalendarId === calendar.id &&
          item.externalEventId === event.id);
        if (existing && existing.status !== 'cancelled') await agenda.cancel(existing.id);
        continue;
      }

      const allDay = Boolean(event.start?.date);
      const startsAt = eventDate(event.start?.dateTime ?? event.start?.date, allDay);
      const endsAt = eventDate(event.end?.dateTime ?? event.end?.date, allDay);
      if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Google retornou um evento com datas inválidas. Nenhuma reconciliação será concluída.');

      await agenda.upsertImported({
        importedUid: uid,
        importedStableUid: uid,
        importedCalendarId: accountCalendarId,
        importedCalendarName: calendar.summary,
        externalProvider: 'google',
        externalAccountId: accountId ?? undefined,
        externalCalendarId: calendar.id,
        externalEventId: event.id,
        ...(event.etag ? { externalEtag: event.etag } : {}),
        title: (event.summary || 'Sem título').slice(0, 120),
        type: classifyImportedAppointment(event.summary || ''),
        startsAt,
        endsAt,
        isAllDay: allDay,
        isRecurring: Boolean(event.recurringEventId),
        ...(event.description ? { description: event.description } : {}),
        ...(event.location ? { location: event.location } : {}),
      });
      seen.push(uid);
      imported += 1;
    }

    if (fullSnapshot) {
      await agenda.reconcileImportedCalendar(accountCalendarId, seen, from.toISOString(), to.toISOString());
    }
    if (result.nextSyncToken) {
      await calendarSyncRepository.save({
        id: stateId,
        provider: 'google',
        calendarId: calendar.id,
        syncToken: result.nextSyncToken,
        lastSyncedAt: new Date().toISOString(),
      });
    }
    return imported;
  }

  async function syncSelected(reason: 'manual' | 'automatic' = 'manual') {
    if (syncInFlight.current || !connected) return;
    const selected = calendars.filter((calendar) => selectedIds.includes(calendar.id));
    if (!selected.length) {
      setError('Selecione ao menos um calendário Google.');
      return;
    }
    syncInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      let total = 0;
      for (const calendar of selected) total += await syncCalendar(calendar);
      const syncedAt = new Date().toISOString();
      setLastSync(syncedAt);
      setMessage((reason === 'automatic' ? 'Atualização automática' : 'Sincronização concluída') +
        ': ' + total + ' evento(s) recebido(s) de ' + selected.length + ' calendário(s).');
      await onChanged();
    } catch (cause) {
      reportError(cause, 'Não foi possível sincronizar o Google Calendar.');
    } finally {
      syncInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!connected) return;
    const runIfVisible = () => {
      if (document.visibilityState === 'visible') void syncSelected('automatic');
    };
    const interval = window.setInterval(runIfVisible, AUTO_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', runIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', runIfVisible);
    };
  }, [connected, accountId, calendars, selectedIds]);

  async function connect() {
    setError('');
    try {
      await beginGoogleCalendarConnection();
      setConnected(true);
      const session = await getGoogleCalendarSession();
      setAccountId(session.accountId);
      await loadCalendars();
      setMessage('Conta Google conectada. Mantenha a janela do Apps Script aberta durante a sincronização.');
    } catch (cause) {
      setConnected(false);
      setAccountId(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a conexão Google.');
    }
  }

  async function refreshCalendars() {
    setBusy(true);
    setError('');
    try {
      await loadCalendars();
      setMessage('Lista de calendários atualizada.');
    } catch (cause) {
      reportError(cause, 'Não foi possível listar os calendários.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar o Google Calendar do Alfred? Os eventos já importados continuarão na sua agenda local.')) return;
    setBusy(true);
    try {
      const result = await disconnectGoogleCalendar();
      setConnected(false);
      setAccountId(null);
      setCalendars([]);
      setSelectedIds([]);
      setMessage(
        result.googleRevocation === 'confirmed'
          ? 'Conta Google desconectada e autorização revogada no Google. Seus compromissos locais foram preservados.'
          : 'Conta desconectada do Alfred e compromissos locais preservados, mas não foi possível confirmar a revogação no Google. Se desejar, revogue o acesso do Alfred nas configurações da sua Conta Google.',
      );
    } catch (cause) {
      reportError(cause, 'Não foi possível desconectar a conta Google.');
    } finally {
      setBusy(false);
    }
  }

  async function sendToGoogle(item: Appointment) {
    const calendar = calendars.find((candidate) => selectedIds.includes(candidate.id));
    if (!calendar) {
      setError('Selecione um calendário de destino antes de enviar compromissos.');
      return;
    }
    if (!accountId) {
      setError('A conta Google não foi identificada. Reconecte antes de enviar.');
      return;
    }

    let operation: Awaited<ReturnType<typeof pendingGoogleCalendarCreateRepository.getById>> | undefined;
    try {
      const pending = await pendingGoogleCalendarCreateRepository.getAll();
      const existing = pending.find((candidate) => candidate.appointmentId === item.id);
      if (existing && (existing.accountId !== accountId || existing.calendarId !== calendar.id)) {
        setError('Este compromisso possui um envio pendente para outra conta ou calendário. Reconecte a origem e resolva essa tentativa antes de iniciar outra.');
        return;
      }
      operation = existing;
    } catch (cause) {
      reportError(cause, 'Não foi possível verificar operações Google pendentes no dispositivo.');
      return;
    }

    const confirmation = operation
      ? 'O envio anterior de "' + item.title + '" pode ter sido concluído no Google, mas a resposta não foi confirmada. Deseja retomar a mesma operação no calendário "' + calendar.summary + '"?'
      : 'Enviar "' + item.title + '" para o calendário Google "' + calendar.summary + '"?';
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setError('');
    try {
      if (!operation) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const operationId = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        operation = {
          id: operationId,
          provider: 'google',
          appointmentId: item.id,
          accountId,
          calendarId: calendar.id,
          eventId: operationId,
          event: toGoogleEvent(item),
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        // Persist before the network call: retries after timeout/reload reuse
        // the same Google event ID and exact event snapshot.
        await pendingGoogleCalendarCreateRepository.save(operation);
      }

      const created = await createGoogleEvent(calendar.id, operation.eventId, operation.id, operation.event);
      await agenda.update(item.id, {
        importedUid: 'google:' + accountId + ':' + calendar.id + ':' + created.id,
        importedStableUid: 'google:' + accountId + ':' + calendar.id + ':' + created.id,
        importedCalendarId: 'google:' + accountId + ':' + calendar.id,
        importedCalendarName: calendar.summary,
        externalProvider: 'google',
        externalAccountId: accountId,
        externalCalendarId: calendar.id,
        externalEventId: created.id,
        externalEtag: created.etag,
      });
      await pendingGoogleCalendarCreateRepository.delete(operation.id);
      setMessage('Compromisso enviado ao Google. A operação foi confirmada e a cópia local foi mantida.');
      await onChanged();
    } catch (cause) {
      if (operation) {
        try {
          await pendingGoogleCalendarCreateRepository.save({ ...operation, status: 'uncertain' });
        } catch {
          setError('O resultado do envio é incerto e não foi possível atualizar o registro local da tentativa. Não crie outro evento manualmente; verifique o Google Calendar antes de tentar novamente.');
          return;
        }
      }
      reportError(cause, 'Não foi possível confirmar o envio. A tentativa foi preservada localmente para uma retomada segura.');
    } finally {
      setBusy(false);
    }
  }

  async function updateInGoogle(item: Appointment) {
    if (!item.externalCalendarId || !item.externalEventId || item.externalAccountId !== accountId) {
      setError('Este compromisso pertence a outra conta Google. Reconecte a conta original para alterá-lo.');
      return;
    }
    if (!window.confirm('Atualizar "' + item.title + '" no Google Calendar?')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await updateGoogleEvent(item.externalCalendarId, item.externalEventId, toGoogleEvent(item), item.externalEtag);
      await agenda.update(item.id, { externalEtag: updated.etag });
      setMessage('Alterações enviadas ao Google. A cópia local foi preservada.');
      await onChanged();
    } catch (cause) {
      reportError(cause, 'Não foi possível atualizar o evento Google.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFromGoogle(item: Appointment) {
    if (!item.externalCalendarId || !item.externalEventId || item.externalAccountId !== accountId) {
      setError('Este compromisso pertence a outra conta Google. Reconecte a conta original para excluí-lo.');
      return;
    }
    if (!window.confirm('Excluir "' + item.title + '" também do Google Calendar? Esta ação não pode ser desfeita.')) return;
    setBusy(true);
    setError('');
    try {
      await deleteGoogleEvent(item.externalCalendarId, item.externalEventId, item.externalEtag);
      await agenda.update(item.id, {
        importedUid: undefined,
        importedStableUid: undefined,
        importedCalendarId: undefined,
        importedCalendarName: undefined,
        externalProvider: undefined,
        externalAccountId: undefined,
        externalCalendarId: undefined,
        externalEventId: undefined,
        externalEtag: undefined,
      });
      setMessage('Evento excluído do Google. A cópia local foi mantida e desvinculada.');
      await onChanged();
    } catch (cause) {
      reportError(cause, 'Não foi possível excluir o evento Google.');
    } finally {
      setBusy(false);
    }
  }

  const localUnlinked = appointments.filter((item) =>
    item.status !== 'cancelled' && !item.externalProvider && !item.importedUid,
  );
  const linkedGoogle = appointments.filter((item) =>
    item.status !== 'cancelled' && item.externalProvider === 'google' && item.externalEventId && item.externalAccountId === accountId,
  );

  return (
    <section className="entry-panel apple-calendar-panel google-calendar-panel" aria-labelledby="google-calendar-title">
      <div className="apple-calendar-heading">
        <div><span className="card-label">INTEGRAÇÃO WEB</span><h3 id="google-calendar-title">Google Calendar</h3></div>
        <span className={connected ? 'apple-calendar-indicator' : 'apple-calendar-unavailable'}><span /> {connected ? 'Conectado nesta sessão' : 'Não conectado'}</span>
      </div>
      <p>Conecte sua conta Google para importar eventos e enviar compromissos do Alfred. Seus dados continuam no dispositivo; somente operações que você confirmar serão enviadas ao Google. Mantenha a janela do Google Apps Script aberta durante a conexão.</p>
      <div className="apple-calendar-actions">
        {!connected ? (
          <button className="primary-action" type="button" disabled={busy} onClick={() => void connect()}>Conectar Google Calendar</button>
        ) : (
          <>
            <button className="primary-action" type="button" disabled={busy} onClick={() => void syncSelected('manual')}>{busy ? 'Aguarde...' : 'Sincronizar agora'}</button>
            <button className="text-action" type="button" disabled={busy} onClick={() => void refreshCalendars()}>Atualizar calendários</button>
            <button className="text-action" type="button" disabled={busy} onClick={() => void disconnect()}>Desconectar</button>
          </>
        )}
      </div>
      {connected && (
        <>
          <div className="apple-calendar-picker">
            <strong>Calendários Google selecionados</strong>
            {calendars.length === 0 ? <p>Nenhum calendário disponível.</p> : calendars.map((calendar) => (
              <label key={calendar.id} className="apple-calendar-option">
                <input type="checkbox" checked={selectedIds.includes(calendar.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, calendar.id] : current.filter((id) => id !== calendar.id))} />
                <span><b>{calendar.summary}</b><small>{calendar.primary ? 'Principal' : calendar.timeZone || 'Google Calendar'}</small></span>
              </label>
            ))}
          </div>
          <div className="apple-calendar-diagnostics">
            <div className="apple-calendar-diagnostics-heading"><strong>Sincronização</strong><span>{busy ? 'Em andamento' : 'Manual + automática'}</span></div>
            <div className="apple-calendar-diagnostic-grid">
              <div><small>Calendários</small><strong>{selectedIds.length}</strong></div>
              <div><small>Eventos Google na Agenda</small><strong>{appointments.filter((item) => item.externalProvider === 'google' && item.status !== 'cancelled').length}</strong></div>
              <div><small>Eventos locais prontos para envio</small><strong>{localUnlinked.length}</strong></div>
              <div><small>Atualização automática</small><strong>A cada 5 min</strong></div>
            </div>
            <p className="apple-calendar-diagnostic-note">A sincronização automática ocorre quando esta página está aberta e visível. O Safari pode suspender a atividade em segundo plano.</p>
          </div>
          {localUnlinked.length > 0 && (
            <div className="apple-calendar-picker">
              <strong>Enviar compromissos locais ao Google</strong>
              {localUnlinked.slice(0, 8).map((item) => (
                <div className="apple-calendar-option" key={item.id}>
                  <span><b>{item.title}</b><small>{new Date(item.startsAt).toLocaleString('pt-BR')}</small></span>
                  <button className="text-action" type="button" disabled={busy || selectedIds.length === 0} onClick={() => void sendToGoogle(item)}>Enviar</button>
                </div>
              ))}
            </div>
          )}
          {linkedGoogle.length > 0 && (
            <div className="apple-calendar-picker">
              <strong>Compromissos vinculados</strong>
              {linkedGoogle.slice(0, 8).map((item) => (
                <div className="apple-calendar-option" key={item.id}>
                  <span><b>{item.title}</b><small>Google · {new Date(item.startsAt).toLocaleString('pt-BR')}</small></span>
                  <div><button className="text-action" type="button" disabled={busy} onClick={() => void updateInGoogle(item)}>Atualizar</button><button className="text-action" type="button" disabled={busy} onClick={() => void removeFromGoogle(item)}>Excluir no Google</button></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {lastSync && <small className="apple-calendar-last-sync">Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}</small>}
      {message && <p className="module-feedback" role="status">{message}</p>}
      {error && <p className="module-error" role="alert">{error}</p>}
    </section>
  );
}
