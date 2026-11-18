import { useEffect, useState, type FormEvent } from 'react';
import { EditDialog } from '../components/EditDialog';
import type { Task, TaskPriority } from './tasks/types';
import type { Project } from './projects/types';
import { createTaskService } from './tasks/taskService';
import { createProjectService } from './projects/projectService';
import { taskRepository, projectRepository } from '../storage/repositories';

export const tasks = createTaskService(taskRepository);
export const projects = createProjectService(projectRepository);
export const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
type Callbacks = { onClose: () => void; onSaved: () => void };

export function TaskEditor({ item, date, scopedProjectId, onClose, onSaved }: Callbacks & {
  item?: Task; date?: string; scopedProjectId?: string;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(item?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? date ?? '');
  const [projectId, setProjectId] = useState(scopedProjectId ?? item?.projectId ?? '');
  const [choices, setChoices] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (scopedProjectId) return;
    let active = true;
    projects.list().then((items) => { if (active) setChoices(items); })
      .catch(() => { if (active) setError('Não foi possível carregar a lista de projetos.'); });
    return () => { active = false; };
  }, [scopedProjectId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const input = { title, description, priority, dueDate: dueDate || undefined, projectId: projectId || undefined };
      if (item) await tasks.update(item.id, input);
      else await tasks.create(input);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a tarefa.');
      setBusy(false);
    }
  }

  return <EditDialog title={item ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
    <form className="dialog-form" onSubmit={save} data-saving={busy || undefined}>
      <label htmlFor="task-title">Título</label><input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      <label htmlFor="task-description">Detalhes</label><textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      <div className="form-grid">
        <div><label htmlFor="task-priority">Prioridade</label><select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
          {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>
        <div><label htmlFor="task-date">Prazo</label><input id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
      </div>
      {!scopedProjectId && <><label htmlFor="task-project">Projeto</label><select id="task-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
        <option value="">Sem projeto</option>{choices.filter((record) => record.status === 'active' || record.id === projectId).map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
      </select></>}
      {error && <p className="module-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit" disabled={busy}>Salvar tarefa</button>
    </form>
  </EditDialog>;
}

export function ProjectEditor({ item, onClose, onSaved }: Callbacks & { item?: Project }) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (item) await projects.update(item.id, { name, description });
      else await projects.create({ name, description });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o projeto.');
      setBusy(false);
    }
  }

  return <EditDialog title={item ? 'Editar projeto' : 'Novo projeto'} onClose={onClose}>
    <form className="dialog-form" onSubmit={save} data-saving={busy || undefined}>
      <label htmlFor="project-name">Nome do projeto</label><input id="project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
      <label htmlFor="project-description">Descrição</label><textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      {error && <p className="module-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit" disabled={busy}>Salvar projeto</button>
    </form>
  </EditDialog>;
}
