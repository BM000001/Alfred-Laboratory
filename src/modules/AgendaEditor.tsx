import { useEffect, useState, type FormEvent } from 'react';
import { EditDialog } from '../components/EditDialog';
import { appointmentRepository, projectRepository } from '../storage/repositories';
import { createAgendaService } from './agenda/agendaService';
import { findAppointmentConflicts } from './agenda/agendaRules';
import type { Appointment, AppointmentType } from './agenda/types';
import type { Project } from './projects/types';

export const agenda = createAgendaService(appointmentRepository);

function localDateTime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AgendaEditor({ date, item, onClose, onSaved }: {
  date?: string; item?: Appointment; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [type, setType] = useState<AppointmentType>(item?.type ?? 'personal');
  const [startsAt, setStartsAt] = useState(() => item ? localDateTime(new Date(item.startsAt)) : date ? date + 'T09:00' : localDateTime(new Date(Date.now() + 3_600_000)));
  const [endsAt, setEndsAt] = useState(() => item ? localDateTime(new Date(item.endsAt)) : date ? date + 'T10:00' : localDateTime(new Date(Date.now() + 7_200_000)));
  const [location, setLocation] = useState(item?.location ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [projectId, setProjectId] = useState(item?.projectId ?? '');
  const [allDay, setAllDay] = useState(Boolean(item?.isAllDay));
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    projectRepository.getAll().then((items) => { if (active) setProjects(items); })
      .catch(() => { if (active) setError('Não foi possível carregar a lista de projetos.'); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setError('Informe datas e horários válidos para o compromisso.');
      return;
    }
    if (end <= start) {
      setError('O horário de término deve ser posterior ao início.');
      return;
    }
    setBusy(true);
    try {
      const times = { startsAt: start.toISOString(), endsAt: end.toISOString() };
      const conflicts = findAppointmentConflicts(await agenda.list(), { id: item?.id ?? '__new__', ...times });
      if (conflicts.length) throw new Error('Este horário coincide com ' + conflicts.map((row) => row.title).join(', ') + '.');
      const input = { title: title.trim(), type, ...times, location, description, isAllDay: allDay, projectId: projectId || undefined };
      if (item) await agenda.update(item.id, input);
      else await agenda.create(input);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o compromisso.');
      setBusy(false);
    }
  }

  return <EditDialog title={item ? 'Editar compromisso' : 'Novo compromisso'} onClose={onClose}>
    <form className="dialog-form" onSubmit={save} data-saving={busy || undefined}>
      <label htmlFor="appointment-title">Título</label><input id="appointment-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
      <label className="check-label"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> Evento de dia inteiro</label>
      <div className="form-grid">
        <div><label htmlFor="appointment-start">Início</label><input id="appointment-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></div>
        <div><label htmlFor="appointment-end">Término</label><input id="appointment-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></div>
      </div>
      <label htmlFor="appointment-type">Tipo</label><select id="appointment-type" value={type} onChange={(event) => setType(event.target.value as AppointmentType)}><option value="class">Aula</option><option value="exam">Prova</option><option value="deadline">Prazo</option><option value="personal">Pessoal</option><option value="other">Outro</option></select>
      <label htmlFor="appointment-project">Projeto</label><select id="appointment-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Sem projeto</option>{projects.filter((project) => project.status === 'active' || project.id === projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
      <label htmlFor="appointment-location">Local</label><input id="appointment-location" value={location} onChange={(event) => setLocation(event.target.value)} />
      <label htmlFor="appointment-description">Observações</label><textarea id="appointment-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
      {error && <p className="module-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={busy} type="submit">{item ? 'Salvar alterações' : 'Salvar compromisso'}</button>
    </form>
  </EditDialog>;
}
