import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Task, TaskPriority } from './tasks/types';
import type { Project } from './projects/types';
import { createTaskService } from './tasks/taskService';
import { createProjectService } from './projects/projectService';
import { taskRepository, projectRepository } from '../storage/repositories';
import { filterTasks, isTaskOverdue } from './tasks/taskRules';
import { summarizeProjectTasks } from './projects/projectRules';

const tasks = createTaskService(taskRepository);
const projects = createProjectService(projectRepository);

type Props = { section: 'tarefas' | 'projetos' };

export function PersonalOrganization({ section }: Props) {
  const [taskItems, setTaskItems] = useState<Task[]>([]);
  const [projectItems, setProjectItems] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    const [loadedTasks, loadedProjects] = await Promise.all([tasks.list(), projects.list()]);
    setTaskItems(loadedTasks);
    setProjectItems(loadedProjects);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([tasks.list(), projects.list()])
      .then(([loadedTasks, loadedProjects]) => {
        if (mounted) {
          setTaskItems(loadedTasks);
          setProjectItems(loadedProjects);
        }
      })
      .catch(() => { if (mounted) setError('Não foi possível carregar seus dados locais.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const visibleTasks = useMemo(
    () => filterTasks(taskItems, { status: filter }),
    [taskItems, filter],
  );

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await tasks.create({
        title,
        priority,
        ...(dueDate ? { dueDate } : {}),
        ...(projectId ? { projectId } : {}),
      });
      setTitle('');
      setDueDate('');
      setProjectId('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a tarefa.');
    }
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await projects.create({ name: projectName, ...(projectDescription.trim() ? { description: projectDescription } : {}) });
      setProjectName('');
      setProjectDescription('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o projeto.');
    }
  }

  async function toggleTask(task: Task) {
    setError('');
    try {
      if (task.status === 'completed') {
        await tasks.update(task.id, { status: 'pending' } as never);
      } else {
        await tasks.complete(task.id);
      }
      await refresh();
    } catch {
      setError('Não foi possível atualizar a tarefa.');
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await tasks.delete(task.id);
      await refresh();
    } catch {
      setError('Não foi possível excluir a tarefa.');
    }
  }

  async function archiveProject(project: Project) {
    if (!window.confirm(`Arquivar o projeto "${project.name}"?`)) return;
    try {
      await projects.archive(project.id);
      await refresh();
    } catch {
      setError('Não foi possível arquivar o projeto.');
    }
  }

  if (loading) return <p className="module-feedback">Carregando seus dados...</p>;

  return (
    <section className="organization-module">
      {error && <p className="module-error" role="alert">{error}</p>}

      {section === 'tarefas' ? (
        <>
          <form className="entry-panel" onSubmit={handleTaskSubmit}>
            <div className="panel-heading">
              <div><span className="card-label">NOVA TAREFA</span><h2>O que precisa ser feito?</h2></div>
            </div>
            <label className="field-label" htmlFor="task-title">Título</label>
            <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ex.: Estudar estrutura de dados" required />
            <div className="form-grid">
              <div><label className="field-label" htmlFor="task-priority">Prioridade</label><select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div>
              <div><label className="field-label" htmlFor="task-date">Prazo</label><input id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
              <div><label className="field-label" htmlFor="task-project">Projeto</label><select id="task-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Sem projeto</option>{projectItems.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            </div>
            <button className="primary-action" type="submit">Adicionar tarefa</button>
          </form>

          <div className="list-heading"><div><span className="card-label">SUA LISTA</span><h2>Tarefas</h2></div><label className="filter-control"><span className="sr-only">Filtrar tarefas</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option></select></label></div>
          {visibleTasks.length === 0 ? <div className="empty-state"><strong>Nenhuma tarefa por aqui.</strong><p>Adicione uma tarefa acima para começar a organizar seu dia.</p></div> : (
            <div className="task-list">{visibleTasks.map((task) => (
              <article className={`task-row ${task.status === 'completed' ? 'is-completed' : ''}`} key={task.id}>
                <input aria-label={`Concluir ${task.title}`} type="checkbox" checked={task.status === 'completed'} onChange={() => void toggleTask(task)} />
                <div className="task-content"><strong>{task.title}</strong><div className="task-meta"><span className={`priority priority-${task.priority}`}>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span>{task.dueDate && <span className={isTaskOverdue(task) ? 'overdue' : ''}>{isTaskOverdue(task) ? 'Atrasada · ' : 'Prazo · '}{new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}</span>}{task.projectId && <span>{projectItems.find((item) => item.id === task.projectId)?.name ?? 'Projeto'}</span>}</div></div>
                <button className="text-action" type="button" onClick={() => void deleteTask(task)}>Excluir</button>
              </article>
            ))}</div>
          )}
        </>
      ) : (
        <>
          <form className="entry-panel" onSubmit={handleProjectSubmit}>
            <span className="card-label">NOVO PROJETO</span><h2>Um objetivo de cada vez.</h2>
            <label className="field-label" htmlFor="project-name">Nome do projeto</label>
            <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Ex.: Projeto de conclusão" required />
            <label className="field-label" htmlFor="project-description">Descrição <span className="optional-label">· opcional</span></label>
            <textarea id="project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} rows={2} placeholder="Qual é o objetivo deste projeto?" />
            <button className="primary-action" type="submit">Criar projeto</button>
          </form>
          <div className="list-heading"><div><span className="card-label">ACOMPANHAMENTO</span><h2>Seus projetos</h2></div></div>
          {projectItems.length === 0 ? <div className="empty-state"><strong>Seus projetos começam aqui.</strong><p>Crie um projeto para agrupar tarefas e acompanhar o progresso.</p></div> : (
            <div className="project-list">{projectItems.map((project) => {
              const summary = summarizeProjectTasks(project, taskItems);
              return <article className="project-card" key={project.id}>
                <div className="project-card-top"><div><span className={`project-status ${project.status}`}>{project.status === 'active' ? 'Ativo' : 'Arquivado'}</span><h3>{project.name}</h3></div>{project.status === 'active' && <button className="text-action" type="button" onClick={() => void archiveProject(project)}>Arquivar</button>}</div>
                {project.description && <p>{project.description}</p>}
                <div className="progress-label"><span>{summary.completed} de {summary.total} tarefas concluídas</span><strong>{summary.completionPercentage}%</strong></div>
                <div className="progress-track" role="progressbar" aria-label={`Progresso de ${project.name}`} aria-valuenow={summary.completionPercentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${summary.completionPercentage}%` }} /></div>
              </article>;
            })}</div>
          )}
        </>
      )}
    </section>
  );
}
