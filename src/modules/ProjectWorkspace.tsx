import { useState } from 'react';
import { PersonalOrganization } from './PersonalOrganization';
import { Files } from './Files';
import { Notes } from './Notes';
import type { Project } from './projects/types';
export function ProjectWorkspace() {
  const [project, setProject] = useState<Project>();
  const [tab, setTab] = useState('tarefas');
  if (!project) return <PersonalOrganization section="projetos" onOpenProject={project => { setProject(project); setTab('tarefas'); }} />;
  return <section aria-label={`Espaço de ${project.name}`}>
    <button className="text-action" type="button" onClick={() => { if (window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) setProject(undefined); }}>← Todos os projetos</button>
    <div className="project-workspace-heading"><span className="card-label">ESPAÇO DO PROJETO · {project.status === 'active' ? 'ATIVO' : 'ARQUIVADO'}</span><h2>{project.name}</h2><p>{project.description || 'Tarefas, materiais e decisões reunidos neste espaço.'}</p></div>
    <nav className="workspace-tabs" aria-label="Conteúdo do projeto">{[['tarefas', 'Tarefas'], ['arquivos', 'Arquivos'], ['notas', 'Anotações']].map(([key, label]) => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { if (window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) setTab(key); }}>{label}</button>)}</nav>
    {tab === 'tarefas' && <PersonalOrganization key={project.id} section="tarefas" scopedProjectId={project.id} />}
    {tab === 'arquivos' && <Files key={project.id} projectId={project.id} />}
    {tab === 'notas' && <Notes key={project.id} projectId={project.id} />}
  </section>;
}
