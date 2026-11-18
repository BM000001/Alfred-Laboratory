import { useEffect, useState, type FormEvent } from 'react';
import type { Task } from './tasks/types';
import type { Appointment } from './agenda/types';
import type { Discipline, StudyTopic } from './studies/types';
import type { Project } from './projects/types';
import type { FocusSession } from './productivity/types';
import { taskRepository, appointmentRepository, studyTopicRepository, disciplineRepository, focusSessionRepository, projectRepository } from '../storage/repositories';
import { getAlfredLocalStorageKey } from '../storage/namespace';
import { summarizeStudyProgress } from './studies/studyRules';
import { summarizeFocusSessions } from './productivity/productivityRules';
import { isTaskOverdue } from './tasks/taskRules';
import { sortAppointmentsByStart } from './agenda/agendaRules';

type Props = {
  onResumeStudy: (topic: StudyTopic) => void;
  onNavigate: (section: 'tarefas' | 'agenda' | 'projetos' | 'estudos' | 'produtividade') => void;
};

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
type Weather = { city: string; temperature: number; apparent: number; description: string; code: number; high: number; low: number };
const weatherText = (code: number) => {
  if (code === 0) return 'Céu limpo';
  if ([1, 2].includes(code)) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if ([45, 48].includes(code)) return 'Neblina';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Garoa';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Chuva';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Neve';
  if ([95, 96, 99].includes(code)) return 'Trovoadas';
  return 'Condição variável';
};

export function Overview({ onNavigate, onResumeStudy }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weatherCity, setWeatherCity] = useState(() => localStorage.getItem(getAlfredLocalStorageKey('alfred-weather-city')) ?? '');
  const [cityInput, setCityInput] = useState(() => localStorage.getItem(getAlfredLocalStorageKey('alfred-weather-city')) ?? '');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [showCityForm, setShowCityForm] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      taskRepository.getAll(), appointmentRepository.getAll(), studyTopicRepository.getAll(),
      disciplineRepository.getAll(), focusSessionRepository.getAll(), projectRepository.getAll(),
    ]).then(([loadedTasks, loadedAppointments, loadedTopics, loadedDisciplines, loadedSessions, loadedProjects]) => {
      if (!active) return;
      setTasks(loadedTasks);
      setAppointments(loadedAppointments);
      setTopics(loadedTopics);
      setDisciplines(loadedDisciplines);
      setFocusSessions(loadedSessions);
      setProjects(loadedProjects);
    }).catch(() => {
      if (active) setError('Não foi possível carregar o resumo dos seus dados locais.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!weatherCity.trim()) { setWeather(null); return; }
    const controller = new AbortController();
    setWeatherLoading(true);
    setWeatherError('');
    const query = encodeURIComponent(weatherCity.trim());
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=pt&format=json`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Não foi possível localizar a cidade.'); return response.json(); })
      .then(async (geo) => {
        const place = geo.results?.[0];
        if (!place) throw new Error('Cidade não encontrada. Confira o nome e tente novamente.');
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`, { signal: controller.signal });
        if (!response.ok) throw new Error('A previsão está indisponível no momento.');
        const data = await response.json();
        setWeather({
          city: place.name,
          temperature: Math.round(data.current.temperature_2m),
          apparent: Math.round(data.current.apparent_temperature),
          description: weatherText(data.current.weather_code),
          code: data.current.weather_code,
          high: Math.round(data.daily.temperature_2m_max[0]),
          low: Math.round(data.daily.temperature_2m_min[0]),
        });
      })
      .catch((cause) => { if (!controller.signal.aborted) { setWeather(null); setWeatherError(cause instanceof Error ? cause.message : 'Não foi possível carregar a previsão.'); } })
      .finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    return () => controller.abort();
  }, [weatherCity]);

  const now = new Date();
  const todayKey = dateKey(now);
  const overdue = new Set(tasks.filter((task) => isTaskOverdue(task, now)).map((task) => task.id));
  const priority = { high: 0, medium: 1, low: 2 };
  const pending = tasks.filter((task) => task.status === 'pending').sort((a, b) =>
    Number(overdue.has(b.id)) - Number(overdue.has(a.id)) ||
    priority[a.priority] - priority[b.priority] ||
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const urgent = pending.filter((task) => overdue.has(task.id) || task.dueDate === todayKey || task.priority === 'high');
  const nextTasks = (urgent.length ? urgent : pending).slice(0, 3);
  const scheduled = sortAppointmentsByStart(appointments.filter((item) => item.status === 'scheduled'));
  const todayAppointments = scheduled.filter((item) => dateKey(new Date(item.startsAt)) === todayKey);
  const next = scheduled.find((item) => new Date(item.endsAt) > now);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const agenda = scheduled.filter((item) => item.id !== next?.id &&
    new Date(item.startsAt) < weekEnd && (dateKey(new Date(item.startsAt)) === todayKey || new Date(item.startsAt) > now));
  const disciplinesById = new Map(disciplines.map((discipline) => [discipline.id, discipline]));
  const [nextTopic] = topics.filter((topic) => topic.status === 'pending' && disciplinesById.has(topic.disciplineId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const projectAttention = new Map<string, number>();
  for (const task of pending) {
    if (task.projectId && (overdue.has(task.id) || task.dueDate === todayKey)) {
      projectAttention.set(task.projectId, (projectAttention.get(task.projectId) ?? 0) + 1);
    }
  }
  const attention = projects.map((project) => ({ ...project, dueCount: projectAttention.get(project.id) ?? 0 }))
    .filter((project) => project.status === 'active' && project.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount).slice(0, 3);
  const studyProgress = summarizeStudyProgress(topics);
  const focusSummary = summarizeFocusSessions(focusSessions, now);

  function saveCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    localStorage.setItem(getAlfredLocalStorageKey('alfred-weather-city'), city);
    setWeatherCity(city);
    setShowCityForm(false);
  }

  function appointmentTime(item: Appointment) {
    return item.isAllDay ? 'Dia inteiro' : `${formatTime(item.startsAt)}–${formatTime(item.endsAt)}`;
  }

  return (
    <section className="daily-brief" aria-label="Resumo do Alfred">
      {error ? <p className="module-error" role="alert">{error}</p> : loading ? (
        <p className="module-feedback" role="status">Reunindo suas informações…</p>
      ) : <>
        <div className="brief-grid">
          <section className="brief-feature" aria-labelledby="next-title">
            <div>
              <p className="card-label" id="next-title">{next && new Date(next.startsAt) <= now ? 'EM ANDAMENTO' : 'PRÓXIMO COMPROMISSO'}</p>
              <h2>{next?.title ?? 'Agenda livre'}</h2>
              <p>{next ? [dateKey(new Date(next.startsAt)) === todayKey ? 'Hoje' : formatDate(next.startsAt), appointmentTime(next), next.location].filter(Boolean).join(' · ') : 'Nenhum compromisso futuro na sua agenda.'}</p>
            </div>
            <button type="button" className="secondary-action" onClick={() => onNavigate('agenda')}>Abrir calendário </button>
          </section>
          <section className="brief-panel" aria-labelledby="priorities-title">
            <div className="section-heading">
              <h2 id="priorities-title">Prioridades</h2>
              <button type="button" className="text-action" onClick={() => onNavigate('tarefas')}>Ver tarefas </button>
            </div>
            {nextTasks.length ? <ul className="brief-list">{nextTasks.map((task) =>
              <li key={task.id}><strong>{task.title}</strong><small className={overdue.has(task.id) ? 'brief-overdue' : undefined}>
                {overdue.has(task.id) ? 'Em atraso' : task.dueDate === todayKey ? 'Vence hoje' : task.priority === 'high' ? 'Alta prioridade' : 'Pendente'}
              </small></li>,
            )}</ul> : <p>Nenhuma tarefa pendente.</p>}
          </section>
        </div>
        <div className="brief-grid brief-followup">
          <section className="brief-panel" aria-labelledby="study-resume-title">
            <h2 id="study-resume-title">Continuar estudando</h2>
            {nextTopic ? <div className="brief-resume">
              <div><strong>{nextTopic.title}</strong><p>{disciplinesById.get(nextTopic.disciplineId)?.name}</p></div>
              <button type="button" className="secondary-action" onClick={() => onResumeStudy(nextTopic)}>Retomar unidade</button>
            </div> : <div className="brief-resume"><p>{disciplines.length ? 'Nenhuma unidade pendente.' : 'Organize seu primeiro material por disciplina.'}</p><button type="button" className="text-action" onClick={() => onNavigate('estudos')}>Abrir estudos </button></div>}
            {studyProgress.total > 0 && <div className="brief-progress">
              <progress aria-label="Progresso dos estudos" value={studyProgress.completed} max={studyProgress.total} />
              <small>{studyProgress.completed} de {studyProgress.total} unidades concluídas</small>
            </div>}
          </section>
          <section className="brief-panel" aria-labelledby="projects-title">
            <div className="section-heading"><h2 id="projects-title">Projetos</h2><button type="button" className="text-action" onClick={() => onNavigate('projetos')}>Ver projetos </button></div>
            {attention.length ? <ul className="brief-list">{attention.map((project) => <li key={project.id}><strong>{project.name}</strong><small>{project.dueCount} {project.dueCount === 1 ? "tarefa" : "tarefas"} para hoje ou em atraso</small></li>)}</ul> : <p>Nenhum projeto ativo com tarefas vencidas ou para hoje.</p>}
          </section>
        </div>
        <div className="brief-extra">
          <details className="interface-disclosure">
            <summary>Resumo da agenda <small>{todayAppointments.length} hoje</small></summary>
            {agenda.length ? <ul className="brief-list">{agenda.slice(0, 4).map((item) => <li key={item.id}><strong>{item.title}</strong><small>{formatDate(item.startsAt)} · {appointmentTime(item)}</small></li>)}</ul> : <p>Sem outros compromissos nos próximos sete dias.</p>}
            <button type="button" className="text-action" onClick={() => onNavigate('agenda')}>Ver agenda completa</button>
          </details>
          <details className="interface-disclosure">
            <summary>Foco <small>{focusSummary.todayMinutes} min hoje</small></summary>
            <p>{focusSummary.today} sessões concluídas hoje · {focusSummary.total} no histórico</p>
            <button type="button" className="text-action" onClick={() => onNavigate('produtividade')}>Abrir foco</button>
          </details>
          <details className="interface-disclosure">
            <summary>Previsão do tempo {weather && <small>{weather.city} · {weather.temperature}°</small>}</summary>
            {weatherLoading ? <p role="status">Buscando previsão...</p> : weather ? <>
              <div className="weather-main"><span className="weather-temperature">{weather.temperature}°</span><div><strong>{weather.description}</strong><span>Sensação de {weather.apparent}°</span><span>{weather.city}</span></div></div>
              <div className="weather-range"><span>Máx. <strong>{weather.high}°</strong></span><span>Mín. <strong>{weather.low}°</strong></span><button type="button" className="text-action" onClick={() => setShowCityForm(true)}>Alterar cidade</button></div>
            </> : <div className="weather-empty"><p>{weatherError || 'Escolha uma cidade para consultar a previsão local.'}</p><button type="button" className="text-action" onClick={() => setShowCityForm((value) => !value)}>{weatherCity ? 'Tentar novamente / alterar cidade' : 'Configurar cidade'}</button></div>}
            {showCityForm && <form className="weather-city-form" onSubmit={saveCity}><label htmlFor="weather-city">Cidade para previsão</label><div><input id="weather-city" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Ex.: Belo Horizonte" required maxLength={80}/><button type="submit" className="primary-action">Salvar</button></div></form>}
            <p className="weather-source">Previsão via Open-Meteo. Sua cidade fica salva apenas neste navegador.</p>

          </details>
        </div>
      </>}
    </section>
  );
}
