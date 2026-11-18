import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Assistant } from './Assistant';
import { PersonalOrganization } from './PersonalOrganization';
import { ProjectWorkspace } from './ProjectWorkspace';
import { assistantMessageRepository } from '../storage/repositories';
import { getAlfredLocalStorageKey } from '../storage/namespace';
import type { Project } from './projects/types';

export type ProjectCreation = 'task' | 'note' | 'project' | 'stage' | 'file';
type Action = { label: string; run: () => void };
const threadKey = getAlfredLocalStorageKey('active-conversation');

function readThread() {
  try { return localStorage.getItem(threadKey) || undefined; }
  catch { return undefined; }
}

export function AlfredWorkspace({ showMascot, revision, onActions, onCreate }: {
  showMascot: boolean;
  revision: number;
  onActions: (actions: Action[]) => void;
  onCreate: (kind: ProjectCreation, projectId?: string) => void;
}) {
  const [mode, setMode] = useState<'chat' | 'projects'>('chat');
  const [project, setProject] = useState<Project>();
  const [thread, setThread] = useState(readThread);
  const [threads, setThreads] = useState<{ id?: string; title: string }[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const changed = useCallback(() => setHistoryVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    assistantMessageRepository.getAll().then((saved) => {
      if (!active) return;
      const titles = new Map<string | undefined, string>();
      const latest = new Map<string | undefined, string>();
      for (const message of saved.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        latest.set(message.conversationId, message.createdAt);
        if (message.role === 'user' && !titles.has(message.conversationId)) titles.set(message.conversationId, message.content.slice(0, 70));
      }
      setThreads([...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => ({
        id, title: titles.get(id) ?? (id ? 'Conversa sem mensagem' : 'Conversa inicial'),
      })));
      setHistoryError('');
    }).catch(() => { if (active) setHistoryError('Não foi possível carregar a lista de conversas.'); });
    return () => { active = false; };
  }, [historyVersion]);

  function selectThread(id?: string) {
    setThread(id);
    setMode('chat');
    try {
      if (id) localStorage.setItem(threadKey, id);
      else localStorage.removeItem(threadKey);
    } catch { /* A sessão atual continua disponível. */ }
  }

  useLayoutEffect(() => {
    if (mode === 'chat') onActions([{ label: 'Nova conversa', run: () => selectThread(crypto.randomUUID()) }]);
    else if (!project) onActions([{ label: 'Novo projeto', run: () => onCreate('project') }]);
    else onActions([
      { label: 'Nova tarefa', run: () => onCreate('task', project.id) },
      { label: 'Nova etapa', run: () => onCreate('stage', project.id) },
      { label: 'Nova nota', run: () => onCreate('note', project.id) },
      { label: 'Adicionar arquivo', run: () => onCreate('file', project.id) },
    ]);
  });

  return <section className="alfred-workbench" aria-label="Área Alfred">
    <nav aria-label="Conversas e projetos" className="view-switcher">
      <button type="button" aria-current={mode === 'chat' ? 'page' : undefined} onClick={() => setMode('chat')}>Conversa</button>
      <button type="button" aria-current={mode === 'projects' ? 'page' : undefined} onClick={() => setMode('projects')}>Projetos</button>
    </nav>
    <details className="interface-disclosure conversation-index" hidden={mode !== 'chat'}>
      <summary>Histórico de conversas</summary>
      {historyError && <p role="alert">{historyError}</p>}
      {!threads.length && !historyError && <p>Nenhuma conversa salva.</p>}
      {threads.map(({ id, title }) => <button key={id ?? 'legacy'} className="text-action" type="button"
        aria-current={thread === id ? 'true' : undefined} onClick={() => selectThread(id)}>{title}</button>)}
    </details>
    <div hidden={mode !== 'chat'}>
      <Assistant key={thread ?? 'legacy'} conversationId={thread} showMascot={showMascot} onHistoryChanged={changed} />
    </div>
    {mode === 'projects' && (project ? <ProjectWorkspace key={project.id} project={project} revision={revision} onBack={() => setProject(undefined)} />
      : <PersonalOrganization section="projetos" revision={revision} onOpenProject={setProject} />)}
  </section>;
}
