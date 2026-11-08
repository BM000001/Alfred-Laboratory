import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Appointment, AppointmentType } from './agenda/types';
import { classifyImportedAppointment, findAppointmentConflicts, sortAppointmentsByStart } from './agenda/agendaRules';
import { createAgendaService } from './agenda/agendaService';
import { appointmentRepository } from '../storage/repositories';
import { ICalendarImport } from './ICalendarImport';
import { connectAppleCalendar, isNativeAppleCalendarAvailable, syncAppleCalendar, type NativeCalendarInfo } from './agenda/nativeCalendarBridge';

const agenda = createAgendaService(appointmentRepository);
type ViewMode = 'day' | 'week' | 'month';

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dateKey(value: Date): string {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function typeLabel(type: AppointmentType): string {
  return ({ class: 'Aula', exam: 'Prova', deadline: 'Prazo', personal: 'Pessoal', other: 'Outro' })[type];
}

export function Agenda() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [view, setView] = useState<ViewMode>('week');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AppointmentType>('personal');
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date(Date.now() + 60 * 60_000)));
  const [endsAt, setEndsAt] = useState(() => localDateTime(new Date(Date.now() + 2 * 60 * 60_000)));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [appleBusy, setAppleBusy] = useState(false);
  const appleSyncInFlight = useRef(false);
  const [appleLastResult, setAppleLastResult] = useState<'success' | 'error' | null>(null);
  const [appleImportedCount, setAppleImportedCount] = useState(0);
  const [appleMessage, setAppleMessage] = useState('');
  const [appleLastSync, setAppleLastSync] = useState<string | null>(() => window.localStorage.getItem('alfred.appleCalendarLastSync'));
  const [appleCalendars, setAppleCalendars] = useState<NativeCalendarInfo[]>([]);
  const [selectedAppleCalendars, setSelectedAppleCalendars] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem('alfred.appleCalendarIds');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.every((value): value is string => typeof value === 'string') ? parsed : [];
    } catch {
      return [];
    }
  });
  const [appleConnected, setAppleConnected] = useState(() => selectedAppleCalendars.length > 0);
  const appleAvailable = isNativeAppleCalendarAvailable();

  async function saveAppleEvents(response: Awaited<ReturnType<typeof syncAppleCalendar>>) {
    if (response.snapshotComplete !== true) {
      throw new Error('A leitura do Calendário Apple não confirmou um snapshot completo. Nenhum evento será arquivado nesta sincronização.');
    }
    const snapshotCalendarIds = response.calendarIds ?? [];
    const expectedCalendarIds = [...selectedAppleCalendars].sort();
    if (snapshotCalendarIds.length !== expectedCalendarIds.length ||
        [...snapshotCalendarIds].sort().some((id, index) => id !== expectedCalendarIds[index])) {
      throw new Error('Os calendários consultados não correspondem à seleção atual. A reconciliação foi interrompida para proteger seus compromissos.');
    }
    const syncStart = Date.parse(response.rangeStart ?? '');
    const syncEnd = Date.parse(response.rangeEnd ?? '');
    if (!Number.isFinite(syncStart) || !Number.isFinite(syncEnd) || syncEnd <= syncStart) {
      throw new Error('O intervalo retornado pelo Calendário Apple é inválido. Nenhum evento será arquivado.');
    }
    const events = response.events ?? [];
    if (selectedAppleCalendars.length === 0) {
      throw new Error('Selecione ao menos um calendário antes de sincronizar.');
    }
    if (new Set(snapshotCalendarIds).size !== snapshotCalendarIds.length ||
        events.some((event) =>
          !event.id || !event.calendarId || !selectedAppleCalendars.includes(event.calendarId) ||
          !event.startsAt || !event.endsAt ||
          !Number.isFinite(Date.parse(event.startsAt)) || !Number.isFinite(Date.parse(event.endsAt)) ||
          Date.parse(event.endsAt) <= Date.parse(event.startsAt)
        )) {
      throw new Error('A leitura retornou dados incompletos ou inválidos. Nenhum compromisso será arquivado nesta sincronização.');
    }
    let imported = 0;
    for (const event of events) {
      if (!event.id || !event.startsAt || !event.endsAt || !Number.isFinite(Date.parse(event.startsAt)) || !Number.isFinite(Date.parse(event.endsAt))) continue;
      await agenda.upsertImported({
        importedUid: `apple:${event.id}`,
        importedStableUid: `apple-stable:${event.externalId || event.id}:${event.occurrenceDate || (event.isRecurring ? event.id : 'single')}`,
        importedCalendarId: event.calendarId,
        title: (event.title || 'Sem título').slice(0, 120),
        type: classifyImportedAppointment(event.title || ''),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        isAllDay: event.isAllDay,
        isRecurring: event.isRecurring,
        importedCalendarName: event.calendarTitle,
        ...(event.location ? { location: event.location } : {}),
      });
      imported += 1;
    }
    let removed = 0;
    for (const calendarId of selectedAppleCalendars) {
      // Only a complete native snapshot can archive missing events, and each
      // calendar is reconciled against its own events and the exact native range.
      const snapshotUids = events
        .filter((event) => event.calendarId === calendarId)
        .map((event) => `apple:${event.id}`);
      removed += await agenda.reconcileImportedCalendar(calendarId, snapshotUids, new Date(syncStart).toISOString(), new Date(syncEnd).toISOString());
    }
    await refresh();
    const syncedAt = new Date().toISOString();
    setAppleLastSync(syncedAt);
    window.localStorage.setItem('alfred.appleCalendarLastSync', syncedAt);
    if (removed > 0) setAppleMessage(`${removed} evento(s) removido(s) da origem foram arquivados na Agenda.`);
    return imported;
  }

  async function handleAppleCalendar(connect: boolean) {
    if (appleSyncInFlight.current) return;
    appleSyncInFlight.current = true;
    setAppleBusy(true);
    setAppleLastResult(null);
    setAppleMessage(connect ? 'Solicitando acesso ao Calendário Apple...' : 'Lendo eventos do Calendário Apple...');
    try {
      if (connect) {
        const response = await connectAppleCalendar();
        const calendars = response.calendars ?? [];
        setAppleCalendars(calendars);
        setSelectedAppleCalendars(calendars.map((calendar) => calendar.id));
        setAppleConnected(true);
        setAppleLastResult('success');
        setAppleMessage(`${calendars.length} calendário(s) encontrado(s). Escolha quais deseja sincronizar.`);
      } else {
        const response = await syncAppleCalendar(selectedAppleCalendars);
        const count = await saveAppleEvents(response);
        setAppleImportedCount(count);
        setAppleLastResult('success');
        setAppleMessage(`${count} evento(s) sincronizado(s) de ${selectedAppleCalendars.length} calendário(s). Seus compromissos manuais foram preservados.`);
      }
    } catch (cause) {
      setAppleLastResult('error');
      setAppleMessage(cause instanceof Error ? cause.message : 'Não foi possível sincronizar o Calendário Apple.');
    } finally {
      appleSyncInFlight.current = false;
      setAppleBusy(false);
    }
  }

  async function refresh() {
    const loaded = await agenda.list();
    setItems(sortAppointmentsByStart(loaded));
  }

  useEffect(() => {
    let active = true;
    agenda.list().then((loaded) => {
      if (active) setItems(sortAppointmentsByStart(loaded));
    }).catch(() => {
      if (active) setError('Não foi possível carregar a Agenda. Verifique o armazenamento local do navegador.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (appleConnected) {
      window.localStorage.setItem('alfred.appleCalendarIds', JSON.stringify(selectedAppleCalendars));
    }
  }, [appleConnected, selectedAppleCalendars]);

  // Intentionally run once when the Agenda mounts, using the saved calendar selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!appleAvailable || selectedAppleCalendars.length === 0) return;
    let active = true;
    const synchronize = async (reason: 'initial' | 'change') => {
      if (!active || appleSyncInFlight.current) return;
      appleSyncInFlight.current = true;
      setAppleBusy(true);
      try {
        const response = await syncAppleCalendar(selectedAppleCalendars);
        if (!active) return;
        const count = await saveAppleEvents(response);
        if (active) {
          setAppleImportedCount(count);
          setAppleLastResult('success');
          setAppleMessage(reason === 'change'
            ? `Calendário Apple alterado: ${count} evento(s) atualizado(s) automaticamente.`
            : `Sincronização automática: ${count} evento(s) atualizado(s).`);
        }
      } catch (cause) {
        if (active) {
          setAppleLastResult('error');
          setAppleMessage(cause instanceof Error ? cause.message : 'Não foi possível atualizar o Calendário Apple.');
        }
      } finally {
        appleSyncInFlight.current = false;
        if (active) setAppleBusy(false);
      }
    };
    const onCalendarChanged = () => {
      if (document.visibilityState === 'visible') void synchronize('change');
    };
    window.addEventListener('alfred-native-calendar-changed', onCalendarChanged);
    void synchronize('initial');
    return () => {
      active = false;
      window.removeEventListener('alfred-native-calendar-changed', onCalendarChanged);
    };
  // Rebind when the selected calendars change so native notifications always use
  // the current selection rather than a stale closure.
  }, [appleAvailable, selectedAppleCalendars]);

  const range = useMemo(() => {
    const selected = new Date(`${selectedDate}T12:00:00`);
    const start = startOfDay(selected);
    if (view === 'day') return { start, end: new Date(start.getTime() + 86400000) };
    if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
      return { start, end: new Date(start.getTime() + 7 * 86400000) };
    }
    return {
      start: new Date(selected.getFullYear(), selected.getMonth(), 1),
      end: new Date(selected.getFullYear(), selected.getMonth() + 1, 1),
    };
  }, [selectedDate, view]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const date = new Date(item.startsAt);
    return date >= range.start && date < range.end && item.status !== 'cancelled';
  }), [items, range]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setConflicts([]);
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!startsAt || !endsAt || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setError('Informe datas e horários válidos para o compromisso.');
      return;
    }
    if (end <= start) {
      setError('O horário de término deve ser posterior ao início.');
      return;
    }
    const candidate = { id: '__new__', startsAt: start.toISOString(), endsAt: end.toISOString() };
    const overlaps = findAppointmentConflicts(items, { ...candidate, id: editingId ?? candidate.id });
    if (overlaps.length) {
      setConflicts(overlaps);
      setError('Este horário coincide com outro compromisso. Ajuste o horário antes de salvar.');
      return;
    }
    try {
      const input = { title, type, startsAt: start.toISOString(), endsAt: end.toISOString(), location: location.trim(), description: description.trim() };
      if (editingId) await agenda.update(editingId, input);
      else await agenda.create(input);
      resetForm();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o compromisso.');
    }
  }

  function resetForm() {
    setTitle('');
    setType('personal');
    setStartsAt(localDateTime(new Date(Date.now() + 60 * 60_000)));
    setEndsAt(localDateTime(new Date(Date.now() + 2 * 60 * 60_000)));
    setLocation('');
    setDescription('');
    setEditingId(null);
    setShowForm(false);
    setConflicts([]);
    setError('');
  }

  function editAppointment(item: Appointment) {
    setEditingId(item.id);
    setTitle(item.title);
    setType(item.type);
    setStartsAt(localDateTime(new Date(item.startsAt)));
    setEndsAt(localDateTime(new Date(item.endsAt)));
    setLocation(item.location ?? '');
    setDescription(item.description ?? '');
    setConflicts([]);
    setError('');
    setShowForm(true);
  }

  async function cancelAppointment(item: Appointment) {
    if (!window.confirm(`Cancelar "${item.title}"?`)) return;
    try {
      await agenda.cancel(item.id);
      await refresh();
    } catch {
      setError('Não foi possível cancelar o compromisso.');
    }
  }

  const selectedLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric' as const } : {}),
  });

  return (
    <section className="agenda-module">
      <div className="agenda-toolbar">
        <div>
          <span className="card-label">SEUS COMPROMISSOS</span>
          <h2>{selectedLabel}</h2>
        </div>
        <button className="primary-action" type="button" onClick={() => { if (showForm) resetForm(); else { setEditingId(null); setShowForm(true); setError(''); setConflicts([]); } }}>
          {showForm ? 'Fechar' : '+ Novo compromisso'}
        </button>
      </div>

      <section className="entry-panel apple-calendar-panel" aria-labelledby="apple-calendar-title">
        <div className="apple-calendar-heading"><div><span className="card-label">INTEGRAÇÃO COM APPLE</span><h3 id="apple-calendar-title">Conectar Calendário Apple</h3></div><span className={appleAvailable ? 'apple-calendar-indicator' : 'apple-calendar-unavailable'}><span /> {appleAvailable ? 'Disponível neste dispositivo' : 'Aguardando app iOS'}</span></div>
        {appleAvailable ? <>
          <p>Conecte o calendário do iPhone para trazer seus próximos 90 dias de eventos. A sincronização é somente leitura e não altera seus compromissos manuais. Eventos ausentes só são arquivados quando o iPhone confirma que a leitura foi completa.</p>
          <div className="apple-calendar-actions">
            <button className="primary-action" type="button" disabled={appleBusy} onClick={() => void handleAppleCalendar(true)}>{appleBusy ? 'Aguarde...' : appleConnected ? 'Atualizar lista de calendários' : 'Conectar Calendário Apple'}</button>
            <button className="text-action" type="button" disabled={appleBusy || !appleConnected || selectedAppleCalendars.length === 0} onClick={() => void handleAppleCalendar(false)}>Sincronizar selecionados</button>
          </div>
          {appleConnected && <div className="apple-calendar-picker"><strong>Escolha os calendários para importar</strong>{appleCalendars.length === 0 ? <p>Nenhum calendário disponível para leitura.</p> : appleCalendars.map((calendar) => <label key={calendar.id} className="apple-calendar-option"><input type="checkbox" checked={selectedAppleCalendars.includes(calendar.id)} onChange={(event) => setSelectedAppleCalendars((current) => event.target.checked ? [...current, calendar.id] : current.filter((id) => id !== calendar.id))} /><span><b>{calendar.title}</b><small>{calendar.source}</small></span></label>)}</div>}
          <div className="apple-calendar-diagnostics" aria-label="Diagnóstico da conexão Apple">
            <div className="apple-calendar-diagnostics-heading"><strong>Diagnóstico da conexão</strong><span>{appleBusy ? 'Verificando...' : appleLastResult === 'error' ? 'Atenção necessária' : appleLastResult === 'success' ? 'Última operação concluída' : 'Aguardando primeira sincronização'}</span></div>
            <div className="apple-calendar-diagnostic-grid">
              <div><small>Ambiente</small><strong>{appleAvailable ? 'App iOS nativo' : 'Navegador'}</strong></div>
              <div><small>Calendários selecionados</small><strong>{selectedAppleCalendars.length} de {appleCalendars.length || '—'}</strong></div>
              <div><small>Eventos na última leitura</small><strong>{appleImportedCount}</strong></div>
              <div><small>Eventos Apple na Agenda</small><strong>{items.filter((item) => item.importedUid?.startsWith('apple:') && item.status !== 'cancelled').length}</strong></div>
            </div>
            <p className="apple-calendar-diagnostic-note">{!appleAvailable ? 'A permissão do Calendário só pode ser solicitada no app iOS. O navegador não consegue consultar o estado dessa permissão.' : !appleConnected ? 'Acesso ainda não confirmado. Toque em “Conectar Calendário Apple” para solicitar a permissão do iOS.' : appleLastResult === 'error' ? 'A última operação apresentou erro. Confira a mensagem abaixo e tente novamente.' : appleLastSync ? 'Acesso concedido anteriormente; a última sincronização foi registrada abaixo.' : 'Calendários listados. Faça a primeira sincronização para importar os eventos.'}</p>
          </div>
          {appleLastSync && <small className="apple-calendar-last-sync">Última sincronização: {new Date(appleLastSync).toLocaleString('pt-BR')}</small>}
          {appleMessage && <p className="module-feedback" role="status">{appleMessage}</p>}
        </> : <>
          <p>Você está usando o Alfred pelo navegador. Para adicionar seu calendário diretamente, sem exportar arquivos, será necessário abrir o Alfred no aplicativo iOS nativo, que usa a permissão oficial do sistema Apple.</p>
          <p className="apple-calendar-note">A conexão direta está em preparação e ainda não pode ser ativada nesta página. Enquanto isso, você pode importar um arquivo .ics na seção abaixo.</p>
        </>}
      </section>
      <ICalendarImport existing={items} onImported={refresh} />

      <div className="agenda-controls">
        <label className="agenda-date-label">Data de referência<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <div className="agenda-view-switch" aria-label="Visualização da agenda">
          <button type="button" className={view === 'day' ? 'selected' : ''} onClick={() => setView('day')}>Dia</button>
          <button type="button" className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')}>Semana</button>
          <button type="button" className={view === 'month' ? 'selected' : ''} onClick={() => setView('month')}>Mês</button>
        </div>
      </div>

      {showForm && (
        <form className="entry-panel agenda-form" onSubmit={handleSubmit}>
          <span className="card-label">{editingId ? 'EDITAR COMPROMISSO' : 'NOVO COMPROMISSO'}</span>
          <h2>{editingId ? 'Atualize seus dados.' : 'O que está marcado?'}</h2>
          <label className="field-label" htmlFor="appointment-title">Título</label>
          <input id="appointment-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ex.: Aula de programação" required />
          <div className="form-grid agenda-form-grid">
            <div><label className="field-label" htmlFor="appointment-type">Tipo</label><select id="appointment-type" value={type} onChange={(event) => setType(event.target.value as AppointmentType)}><option value="class">Aula</option><option value="exam">Prova</option><option value="deadline">Prazo</option><option value="personal">Pessoal</option><option value="other">Outro</option></select></div>
            <div><label className="field-label" htmlFor="appointment-start">Início</label><input id="appointment-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></div>
            <div><label className="field-label" htmlFor="appointment-end">Término</label><input id="appointment-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></div>
          </div>
          <label className="field-label" htmlFor="appointment-location">Local <span className="optional-label">· opcional</span></label>
          <input id="appointment-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Sala, endereço ou link" />
          <label className="field-label" htmlFor="appointment-description">Observações <span className="optional-label">· opcional</span></label>
          <textarea id="appointment-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes importantes..." />
          <div className="agenda-form-actions"><button className="primary-action" type="submit">{editingId ? 'Salvar alterações' : 'Salvar compromisso'}</button>{editingId && <button className="text-action" type="button" onClick={resetForm}>Cancelar edição</button>}</div>
        </form>
      )}

      {error && <p className="module-error" role="alert">{error}</p>}
      {conflicts.length > 0 && <div className="agenda-conflicts"><strong>Conflito encontrado</strong>{conflicts.map((item) => <p key={item.id}>{item.title} · {formatTime(item.startsAt)}–{formatTime(item.endsAt)}</p>)}</div>}

      {loading ? <p className="module-feedback">Carregando sua Agenda...</p> : visibleItems.length === 0 ? (
        <div className="empty-state"><strong>Nenhum compromisso neste período.</strong><p>Quando você adicionar aulas, provas e outros eventos, eles aparecerão aqui.</p></div>
      ) : (
        <div className="appointment-list">
          {visibleItems.map((item) => (
            <article className="appointment-card" key={item.id}>
              <div className="appointment-time">{item.isAllDay ? <strong>Dia inteiro</strong> : <><strong>{formatTime(item.startsAt)}</strong><span>{formatTime(item.endsAt)}</span></>}</div>
              <div className="appointment-details">
                <span className={`appointment-type type-${item.type}`}>{typeLabel(item.type)}</span>{item.isRecurring && <span className="appointment-origin-tag">Recorrente</span>}{item.importedCalendarName && <span className="appointment-source-tag">{item.importedCalendarName}</span>}
                <h3>{item.title}</h3>
                <p>{new Date(item.startsAt).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}{item.location ? ` · ${item.location}` : ''}</p>
                {item.description && <p>{item.description}</p>}
              </div>
              <div className="appointment-actions"><button className="text-action" type="button" onClick={() => editAppointment(item)}>Editar</button><button className="text-action" type="button" onClick={() => void cancelAppointment(item)}>Cancelar</button></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
