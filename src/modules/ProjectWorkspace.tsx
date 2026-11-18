import { useEffect, useState, type FormEvent } from 'react';
import { EditDialog } from '../components/EditDialog';
import { PersonalOrganization } from './PersonalOrganization';
import { projects } from './RecordEditors';
import { getProjectStages } from './projects/projectService';
import { Files } from './Files';
import { Notes } from './Notes';
import type { Project } from './projects/types';

export function StageEditor({ projectId, onClose, onSaved }: {
  projectId: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await projects.addStage(projectId, title);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a etapa.');
      setBusy(false);
    }
  }

  return <EditDialog title="Nova etapa" onClose={onClose}>
    <form className="dialog-form" onSubmit={save} data-saving={busy || undefined}>
      <label htmlFor="stage-title">Nome da etapa</label><input id="stage-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
      {error && <p role="alert" className="module-error">{error}</p>}
      <button className="primary-action" type="submit" disabled={busy}>Salvar etapa</button>
    </form>
  </EditDialog>;
}

export function ProjectWorkspace({ project: initial, revision, onBack }: { project: Project; revision: number; onBack: () => void }) {
  const [project, setProject] = useState(initial);
  const [tab, setTab] = useState('tarefas');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const stages = getProjectStages(project);

  useEffect(() => {
    let active = true;
    projects.get(initial.id).then((item) => { if (item && active) setProject(item); })
      .catch(() => { if (active) setError('Não foi possível atualizar o projeto.'); });
    return () => { active = false; };
  }, [initial.id, revision]);

  async function toggle(stageId: string) {
    if (saving) return;
    setSaving(true);
    setError('');
    try { setProject(await projects.toggleStage(project.id, stageId)); }
    catch { setError('Não foi possível atualizar a etapa.'); }
    finally { setSaving(false); }
  }

  return <section className="project-workspace" aria-label={`Espaço de ${project.name}`}>
    <header className="section-heading"><h2>{project.name}</h2>
      <button className="text-action" type="button" onClick={onBack}>Todos os projetos</button>
    </header>
    {project.description && <p>{project.description}</p>}
    {project.status === 'archived' && <p>Projeto arquivado</p>}
    <nav className="view-switcher" aria-label="Conteúdo do projeto">
      {([['tarefas', 'Tarefas'], ['etapas', 'Etapas'], ['arquivos', 'Arquivos'], ['notas', 'Anotações']] as const).map(([key, label]) =>
        <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    {tab === 'tarefas' && <PersonalOrganization section="tarefas" scopedProjectId={project.id} revision={revision} />}
    {tab === 'etapas' && <section className="records-list">
      <h3>Etapas</h3>
      {error && <p role="alert" className="module-error">{error}</p>}
      {stages.length ? <>
        <p>{stages.filter(({ completed }) => completed).length} de {stages.length} etapas concluídas</p>
        {stages.map((stage) => <label className="check-label" key={stage.id}>
          <input type="checkbox" checked={stage.completed} disabled={saving} onChange={() => void toggle(stage.id)} />{stage.title}
        </label>)}
      </> : <p>Use + para adicionar a primeira etapa.</p>}
    </section>}
    {tab === 'arquivos' && <Files projectId={project.id} revision={revision} allowUpload={false} />}
    {tab === 'notas' && <Notes projectId={project.id} revision={revision} />}
  </section>;
}
