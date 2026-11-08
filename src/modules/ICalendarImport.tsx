import { useState, type ChangeEvent } from 'react';
import type { Appointment } from './agenda/types';
import { findAppointmentConflicts } from './agenda/agendaRules';
import { findICalendarDuplicates, parseICalendar, type ICalendarImportItem } from './agenda/icalendarImport';
import { appointmentRepository } from '../storage/repositories';

interface PreviewRow { event: ICalendarImportItem; conflict: boolean }

export function ICalendarImport({ existing, onImported }: { existing: Appointment[]; onImported: () => Promise<void> }) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]); setWarnings([]); setMessage('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.ics') || file.size > 5 * 1024 * 1024) {
      setMessage('Selecione um arquivo .ics de até 5 MB.'); event.target.value = ''; return;
    }
    try {
      const parsed = parseICalendar(await file.text());
      const unique = findICalendarDuplicates(parsed.events, existing);
      const duplicateCount = parsed.events.length - unique.length;
      setRows(unique.map((item) => ({ event: item, conflict: findAppointmentConflicts(existing, { id: '__import__', startsAt: item.startsAt, endsAt: item.endsAt }).length > 0 })));
      setWarnings([...parsed.warnings, ...(duplicateCount ? [duplicateCount + ' evento(s) já importado(s) foram removidos da prévia.'] : [])]);
      if (!unique.length && duplicateCount) setMessage('Todos os eventos desse arquivo já estão na sua Agenda.');
    } catch { setMessage('Não foi possível ler este arquivo de calendário.'); }
  }

  async function importEvents() {
    const accepted = rows.filter((row) => !row.conflict);
    if (!accepted.length) return;
    setBusy(true); setMessage('');
    try {
      for (const row of accepted) {
        const event = row.event;
        const appointment: Appointment = {
          id: crypto.randomUUID(), title: event.title.slice(0, 120), type: 'other', status: 'scheduled',
          startsAt: event.startsAt, endsAt: event.endsAt, createdAt: new Date().toISOString(), importedUid: event.uid,
          ...(event.location ? { location: event.location } : {}), ...(event.description ? { description: event.description } : {}),
        };
        await appointmentRepository.save(appointment);
      }
      await onImported();
      setMessage(accepted.length + ' compromisso(s) importado(s). Sua agenda original não foi alterada.');
      setRows([]); setWarnings([]);
    } catch { setMessage('A importação foi interrompida. Confira a Agenda antes de tentar novamente.'); }
    finally { setBusy(false); }
  }

  return <section className="entry-panel ical-import">
    <span className="card-label">CALENDÁRIO APPLE · PRIMEIRA INTEGRAÇÃO</span>
    <h3>Importar eventos do Calendário Apple</h3>
    <p>O Alfred já consegue ler arquivos de calendário Apple (.ics) diretamente neste dispositivo. No Mac, abra o app Calendário, escolha Arquivo → Exportar → Exportar e selecione o arquivo aqui. A importação cria uma cópia dos eventos; alterações posteriores no calendário Apple ainda não são sincronizadas automaticamente.</p>
    <label className="field-label" htmlFor="ical-file">Arquivo exportado do Calendário Apple (.ics)</label>
    <input id="ical-file" type="file" accept=".ics,text/calendar" onChange={(event) => void handleFile(event)} />
    {warnings.length > 0 && <ul className="ical-warnings">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    {rows.length > 0 && <>
      <p><strong>{rows.length}</strong> evento(s) na prévia. {rows.filter((row) => row.conflict).length} com conflito de horário.</p>
      <div className="ical-preview">{rows.map(({ event, conflict }) => <article key={event.uid + event.startsAt}>
        <strong>{event.title}</strong>
        <span>{new Date(event.startsAt).toLocaleString('pt-BR')} · {event.allDay ? 'Dia inteiro' : new Date(event.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        {event.location && <span>{event.location}</span>}{conflict && <em>Conflito: não será importado</em>}
      </article>)}</div>
      <button className="primary-action" type="button" disabled={busy || rows.every((row) => row.conflict)} onClick={() => void importEvents()}>{busy ? 'Importando...' : 'Importar ' + rows.filter((row) => !row.conflict).length + ' compromisso(s)'}</button>
    </>}
    {message && <p className="module-feedback" role="status">{message}</p>}
  </section>;
}
