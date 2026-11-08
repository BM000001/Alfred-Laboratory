import { useEffect, useMemo, useState } from 'react';
import { focusSessionRepository, taskRepository } from '../storage/repositories';
import type { Task } from './tasks/types';
import type { FocusSession } from './productivity/types';
import { summarizeFocusSessions } from './productivity/productivityRules';

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export function Productivity() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [remaining, setRemaining] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([focusSessionRepository.getAll(), taskRepository.getAll()])
      .then(([items, loadedTasks]) => { if (active) { setSessions(items); setTasks(loadedTasks.filter((task) => task.status === 'pending')); } })
      .catch(() => { if (active) setError('Não foi possível carregar seus dados de produtividade.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || remaining !== 0) return;
    setRunning(false);
    if (mode === 'focus') {
      const completedAt = new Date().toISOString();
      const session: FocusSession = {
        id: crypto.randomUUID(),
        startedAt: startedAt ?? new Date(Date.now() - WORK_SECONDS * 1000).toISOString(),
        completedAt,
        durationMinutes: 25,
        kind: 'focus',
        ...(selectedTaskId ? { taskId: selectedTaskId, taskTitle: tasks.find((task) => task.id === selectedTaskId)?.title } : {}),
      };
      focusSessionRepository.save(session)
        .then(() => setSessions((items) => [...items, session]))
        .catch(() => setError('A sessão terminou, mas não foi possível salvar no histórico.'));
      setMode('break');
      setRemaining(BREAK_SECONDS);
      setStartedAt(null);
    } else {
      setMode('focus');
      setRemaining(WORK_SECONDS);
      setStartedAt(null);
    }
  }, [remaining, running, mode, startedAt]);

  const summary = useMemo(() => summarizeFocusSessions(sessions), [sessions]);
  const total = mode === 'focus' ? WORK_SECONDS : BREAK_SECONDS;
  const progress = ((total - remaining) / total) * 100;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  function reset() {
    setRunning(false);
    setRemaining(mode === 'focus' ? WORK_SECONDS : BREAK_SECONDS);
    setStartedAt(null);
  }

  function changeMode(next: 'focus' | 'break') {
    setRunning(false);
    setMode(next);
    setRemaining(next === 'focus' ? WORK_SECONDS : BREAK_SECONDS);
    setStartedAt(null);
  }

  function toggleRunning() {
    if (!running && mode === 'focus' && remaining === WORK_SECONDS) setStartedAt(new Date().toISOString());
    setRunning((value) => !value);
  }

  return (
    <section className="productivity-module">
      <div className="focus-card">
        <div className="focus-card-heading">
          <div><span className="card-label">SESSÃO ATUAL</span><h2>{mode === 'focus' ? 'Hora de concentrar.' : 'Pausa merecida.'}</h2></div>
          <span className="focus-session-count">{summary.today} {summary.today === 1 ? 'sessão hoje' : 'sessões hoje'}</span>
        </div>
        <label className="field-label focus-task-label" htmlFor="focus-task">Tarefa desta sessão</label>
        <select id="focus-task" className="focus-task-select" value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} disabled={running}>
          <option value="">Foco livre · sem tarefa vinculada</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
        <div className="focus-mode-switch" role="group" aria-label="Tipo de sessão">
          <button type="button" className={mode === 'focus' ? 'selected' : ''} onClick={() => changeMode('focus')}>Foco · 25 min</button>
          <button type="button" className={mode === 'break' ? 'selected' : ''} onClick={() => changeMode('break')}>Pausa · 5 min</button>
        </div>
        <div className="focus-clock" aria-live="off"><span>{minutes}</span><i>:</i><span>{seconds}</span></div>
        <div className="focus-progress" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: progress + '%' }} /></div>
        <p className="focus-guidance">{running ? 'Uma coisa de cada vez. Alfred está cuidando do tempo.' : 'Escolha uma tarefa, afaste as distrações e comece quando estiver pronto.'}</p>
        <div className="focus-actions">
          <button className="primary-action" type="button" onClick={toggleRunning}>{running ? 'Pausar sessão' : 'Iniciar sessão'}</button>
          <button className="secondary-action" type="button" onClick={reset}>Reiniciar</button>
        </div>
      </div>
      <div className="focus-side-card">
        <span className="card-label">SEU RITMO</span>
        <h3>{summary.todayMinutes} min de foco hoje.</h3>
        <p>{summary.today} sessões concluídas hoje · {summary.total} no histórico total. Seus registros ficam salvos neste dispositivo.</p>
        <div className="focus-cycle" aria-label={summary.today % 4 + ' de 4 sessões no ciclo'}>
          {[0, 1, 2, 3].map((item) => <span key={item} className={item < summary.today % 4 ? 'done' : ''} />)}
        </div>
        <small>{summary.today % 4} de 4 sessões neste ciclo</small>
      </div>
      <section className="focus-history">
        <div className="list-heading"><div><span className="card-label">REGISTROS</span><h2>Últimas sessões</h2></div><span className="focus-session-count">{loading ? 'Carregando...' : `${summary.total} no total`}</span></div>
        {error && <p className="module-error" role="alert">{error}</p>}
        {summary.recent.length === 0 ? <div className="empty-state"><strong>Nenhuma sessão concluída ainda.</strong><p>Quando terminar seu primeiro ciclo de foco, ele aparecerá aqui.</p></div> :
          <div className="focus-history-list">{summary.recent.map((session) => <article className="focus-history-item" key={session.id}><span className="focus-history-dot" /><div><strong>{session.taskTitle ? session.taskTitle : 'Sessão de foco livre'}</strong><small>{new Date(session.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div><b>{session.durationMinutes} min</b></article>)}</div>}
      </section>
    </section>
  );
}
