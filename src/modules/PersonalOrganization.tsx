import { useEffect, useState } from 'react';
import type { Task } from './tasks/types';
import type { Project } from './projects/types';
import { filterTasks, isTaskOverdue } from './tasks/taskRules';
import { summarizeProjectTasks } from './projects/projectRules';
import { ProjectEditor, TaskEditor, priorityLabels, projects, tasks } from './RecordEditors';

type Props = {
  section: 'tarefas' | 'projetos';
  scopedProjectId?: string;
  date?: string;
  revision?: number;
  onChanged?: () => void;
  onOpenProject?: (project: Project) => void;
};

export function PersonalOrganization({ section, scopedProjectId, date, onOpenProject, revision = 0, onChanged }: Props) {
  const [taskItems, setTaskItems] = useState<Task[]>([]);
  const [projectItems, setProjectItems] = useState<Project[]>([]);
  const [editingTask, setEditingTask] = useState<Task>();
  const [editingProject, setEditingProject] = useState<Project>();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [undated, setUndated] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([tasks.list(), projects.list()]).then(([loadedTasks, loadedProjects]) => {
      if (active) {
        setTaskItems(loadedTasks);
        setProjectItems(loadedProjects);
      }
    }).catch(() => { if (active) setError('Não foi possível carregar seus dados locais.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, version]);

  function changed() {
    setVersion((current) => current + 1);
    onChanged?.();
  }

  async function update(run: () => Promise<unknown>, message: string) {
    try {
      setError('');
      await run();
      changed();
    } catch { setError(message); }
  }

  const visible = filterTasks(taskItems, { status: filter, projectId: scopedProjectId })
    .filter((task) => !date || (undated ? !task.dueDate : task.dueDate === date));
  const scopedTasks = scopedProjectId ? taskItems.filter((task) => task.projectId === scopedProjectId) : [];
  const scopedCompleted = scopedTasks.filter((task) => task.status === 'completed').length;
  if (loading) return <p role="status">Carregando seus dados…</p>;

  return <section className="records-list" aria-label={section === 'tarefas' ? 'Lista de tarefas' : 'Lista de projetos'}>
    {error && <p className="module-error" role="alert">{error}</p>}
    {section === 'tarefas' ? <>
      <div className="section-heading">
        <h2>{date && !undated ? 'Tarefas da data selecionada' : date ? 'Tarefas sem data' : 'Tarefas'}</h2>
        <select aria-label="Filtrar tarefas" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option>
        </select>
        {date && <button type="button" className="text-action" onClick={() => setUndated(!undated)}>{undated ? 'Tarefas da data' : 'Ver sem data'}</button>}
      </div>
      {scopedTasks.length > 0 && <div className="brief-progress">
        <progress aria-label="Progresso das tarefas deste projeto" max={scopedTasks.length} value={scopedCompleted} />
        <small>{scopedCompleted} de {scopedTasks.length} tarefas concluídas</small>
      </div>}
      {visible.length ? <div className="task-list">{visible.map((task) => <article className="task-row" key={task.id}>
        <label className="check-label"><input aria-label={`Concluir ${task.title}`} type="checkbox" checked={task.status === 'completed'} onChange={() => void update(
          () => tasks.update(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' }), 'Não foi possível atualizar a tarefa.',
        )} /></label>
        <div className="task-content">
          <button type="button" className="text-action" onClick={() => setEditingTask(task)}><strong>{task.title}</strong></button>
          {task.description && <p>{task.description}</p>}
          <div className="task-meta"><span>{priorityLabels[task.priority]}</span><span>{task.status === 'completed' ? 'Concluída' : 'Pendente'}</span>
            {task.dueDate && <span className={isTaskOverdue(task) ? 'overdue' : ''}>{new Date(task.dueDate + 'T12:00').toLocaleDateString('pt-BR')}</span>}
            {!scopedProjectId && task.projectId && <span>{projectItems.find((project) => project.id === task.projectId)?.name ?? 'Projeto'}</span>}
          </div>
        </div>
        <button className="text-action" type="button" onClick={() => {
          if (window.confirm(`Excluir a tarefa “${task.title}”?`)) void update(() => tasks.delete(task.id), 'Não foi possível excluir a tarefa.');
        }}>Excluir</button>
      </article>)}</div> : <p>Nenhuma tarefa nesta lista.</p>}
      {editingTask && <TaskEditor item={editingTask} scopedProjectId={scopedProjectId} onClose={() => setEditingTask(undefined)} onSaved={() => { setEditingTask(undefined); changed(); }} />}
    </> : <>
      <h2>Seus projetos</h2>
      {projectItems.length ? <div className="project-list">{projectItems.map((project) => {
        const summary = summarizeProjectTasks(project, taskItems);
        return <article className="project-card" key={project.id}>
          <div className="section-heading">
            <h3><button className="text-action" type="button" onClick={() => onOpenProject?.(project)}>{project.name}</button></h3>
            <small>{project.status === 'active' ? 'Ativo' : 'Arquivado'}</small>
          </div>
          {project.description && <p>{project.description}</p>}
          <div className="brief-progress"><progress aria-label={`Progresso de ${project.name}`} max={100} value={summary.completionPercentage} />
            <small>{summary.completed} de {summary.total} tarefas concluídas</small></div>
          <button className="text-action" type="button" onClick={() => setEditingProject(project)}>Editar</button>
          {project.status === 'active' && <button className="text-action" type="button" onClick={() => {
            if (window.confirm(`Arquivar “${project.name}”?`)) void update(() => projects.archive(project.id), 'Não foi possível arquivar o projeto.');
          }}>Arquivar</button>}
        </article>;
      })}</div> : <p>Nenhum projeto. Use + para criar.</p>}
      {editingProject && <ProjectEditor item={editingProject} onClose={() => setEditingProject(undefined)} onSaved={() => { setEditingProject(undefined); changed(); }} />}
    </>}
  </section>;
}
