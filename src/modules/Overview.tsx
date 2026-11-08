import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Task } from './tasks/types';
import type { Appointment } from './agenda/types';
import type { Discipline, StudyTopic } from './studies/types';
import type { FocusSession } from './productivity/types';
import { taskRepository, appointmentRepository, studyTopicRepository, disciplineRepository, focusSessionRepository } from '../storage/repositories';
import { summarizeStudyProgress } from './studies/studyRules';
import { summarizeFocusSessions } from './productivity/productivityRules';
import { isTaskOverdue } from './tasks/taskRules';
import { sortAppointmentsByStart } from './agenda/agendaRules';

type Props = {
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

export function Overview({ onNavigate }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weatherCity, setWeatherCity] = useState(() => localStorage.getItem('alfred-weather-city') ?? '');
  const [cityInput, setCityInput] = useState(() => localStorage.getItem('alfred-weather-city') ?? '');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [showCityForm, setShowCityForm] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      taskRepository.getAll(), appointmentRepository.getAll(), studyTopicRepository.getAll(),
      disciplineRepository.getAll(), focusSessionRepository.getAll(),
    ]).then(([loadedTasks, loadedAppointments, loadedTopics, loadedDisciplines, loadedSessions]) => {
      if (!active) return;
      setTasks(loadedTasks);
      setAppointments(loadedAppointments);
      setTopics(loadedTopics);
      setDisciplines(loadedDisciplines);
      setFocusSessions(loadedSessions);
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
  const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now));
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const todayAppointments = useMemo(() => sortAppointmentsByStart(
    appointments.filter((item) => item.status === 'scheduled' && item.startsAt.slice(0, 10) === todayKey),
  ), [appointments, todayKey]);
  const weekAppointments = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return sortAppointmentsByStart(appointments.filter((item) => {
      const startAt = new Date(item.startsAt);
      return item.status === 'scheduled' && startAt >= start && startAt < end && item.startsAt.slice(0, 10) !== todayKey;
    })).slice(0, 4);
  }, [appointments, todayKey, now.toDateString()]);
  const todayTopics = topics.filter((topic) => topic.status === 'pending').slice(0, 4);
  const studyProgress = summarizeStudyProgress(topics);
  const focusSummary = summarizeFocusSessions(focusSessions, now);

  function saveCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    localStorage.setItem('alfred-weather-city', city);
    setWeatherCity(city);
    setShowCityForm(false);
  }

  return (
    <section className="dashboard" aria-label="Resumo do Alfred">
      {error && <p className="module-error" role="alert">{error}</p>}
      {loading ? <p className="module-feedback">Reunindo suas informações...</p> : <>
        <div className="dashboard-greeting">
          <div><span className="card-label">SEU RESUMO</span><h2>Visão geral</h2><p>{todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)} · aqui está o que importa hoje.</p></div>
          <button type="button" className="dashboard-link" onClick={() => onNavigate('agenda')}>Abrir agenda ↗</button>
        </div>

        <div className="dashboard-summary">
          <button type="button" className="dashboard-stat stat-overdue" onClick={() => onNavigate('tarefas')}>
            <span className="stat-icon stat-icon-alert" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg></span><span className="card-label">EM ATRASO</span>
            <strong>{overdueTasks.length}</strong><p>{overdueTasks.length === 1 ? 'tarefa vencida' : 'tarefas vencidas'}</p>
            <span className="dashboard-link">Revisar tarefas →</span>
          </button>
          <button type="button" className="dashboard-stat" onClick={() => onNavigate('tarefas')}>
            <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span><span className="card-label">PENDENTES</span>
            <strong>{pendingTasks.length}</strong><p>tarefas esperando por você</p>
            <span className="dashboard-link">Ver pendências →</span>
          </button>
          <button type="button" className="dashboard-stat" onClick={() => onNavigate('agenda')}>
            <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4m8-4v4M3.5 10h17m-12 4h3"/></svg></span><span className="card-label">COMPROMISSOS HOJE</span>
            <strong>{todayAppointments.length}</strong><p>{todayAppointments.length === 1 ? 'compromisso no dia' : 'compromissos no dia'}</p>
            <span className="dashboard-link">Ver agenda →</span>
          </button>
        </div>

        <div className="dashboard-home-grid">
          <section className="dashboard-panel weather-panel" aria-labelledby="weather-title">
            <div className="dashboard-panel-heading"><div><span className="card-label">TEMPO AGORA</span><h2 id="weather-title">Previsão do tempo</h2></div><span className="weather-symbol" aria-hidden="true">☼</span></div>
            {weatherLoading ? <p className="dashboard-empty">Buscando previsão...</p> : weather ? <>
              <div className="weather-main"><span className="weather-temperature">{weather.temperature}°</span><div><strong>{weather.description}</strong><span>Sensação de {weather.apparent}°</span><span>{weather.city}</span></div></div>
              <div className="weather-range"><span>Máx. <strong>{weather.high}°</strong></span><span>Mín. <strong>{weather.low}°</strong></span><button type="button" className="dashboard-link" onClick={() => setShowCityForm(true)}>Alterar cidade</button></div>
            </> : <div className="weather-empty"><p>{weatherError || 'Escolha uma cidade para consultar a previsão local.'}</p><button type="button" className="dashboard-link" onClick={() => setShowCityForm((value) => !value)}>{weatherCity ? 'Tentar novamente / alterar cidade' : 'Configurar cidade →'}</button></div>}
            {showCityForm && <form className="weather-city-form" onSubmit={saveCity}><label htmlFor="weather-city">Cidade para previsão</label><div><input id="weather-city" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Ex.: Belo Horizonte" required maxLength={80}/><button type="submit" className="primary-action">Salvar</button></div></form>}
            <p className="weather-source">Previsão via Open-Meteo. Sua cidade fica salva apenas neste navegador.</p>
          </section>

          <section className="dashboard-panel subjects-panel" aria-labelledby="subjects-title">
            <div className="dashboard-panel-heading"><div><span className="card-label">PARA ESTUDAR</span><h2 id="subjects-title">Matérias do dia</h2></div><button type="button" className="dashboard-link" onClick={() => onNavigate('estudos')}>Ver estudos →</button></div>
            {todayTopics.length === 0 ? <p className="dashboard-empty">{disciplines.length ? 'Nenhum conteúdo pendente cadastrado. Adicione tópicos em Estudos para montar sua lista.' : 'Cadastre suas matérias e conteúdos em Estudos para vê-los aqui.'}</p> : <ul className="dashboard-subject-list">{todayTopics.map((topic) => <li key={topic.id}><span className="subject-dot" aria-hidden="true"/><div><strong>{topic.title}</strong><span>{disciplines.find((discipline) => discipline.id === topic.disciplineId)?.name ?? 'Disciplina'}</span></div><span className="subject-status">Pendente</span></li>)}</ul>}
            <div className="study-mini-progress"><span>Progresso dos estudos</span><strong>{studyProgress.percentage}%</strong><div className="progress-track" role="progressbar" aria-label="Progresso dos estudos" aria-valuenow={studyProgress.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${studyProgress.percentage}%` }}/></div></div>
          </section>
        </div>

        <div className="dashboard-columns">
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading"><div><span className="card-label">HOJE</span><h2>Compromissos do dia</h2></div><button type="button" className="dashboard-link" onClick={() => onNavigate('agenda')}>Ver todos →</button></div>
            {todayAppointments.length === 0 ? <p className="dashboard-empty">Nenhum compromisso marcado para hoje.</p> : <ul className="dashboard-event-list">{todayAppointments.map((item) => <li key={item.id}><div className="event-date"><strong>{formatTime(item.startsAt)}</strong><span>{formatTime(item.endsAt)}</span></div><div><strong>{item.title}</strong><span>{item.location || ({ class: 'Aula', exam: 'Prova', deadline: 'Prazo', personal: 'Pessoal', other: 'Outro' }[item.type])}</span></div></li>)}</ul>}
          </section>
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading"><div><span className="card-label">PRÓXIMOS 7 DIAS</span><h2>Esta semana</h2></div><button type="button" className="dashboard-link" onClick={() => onNavigate('agenda')}>Abrir agenda →</button></div>
            {weekAppointments.length === 0 ? <p className="dashboard-empty">Sem outros compromissos nos próximos sete dias.</p> : <ul className="dashboard-event-list">{weekAppointments.map((item) => <li key={item.id}><div className="event-date"><strong>{formatDate(item.startsAt)}</strong><span>{formatTime(item.startsAt)}</span></div><div><strong>{item.title}</strong><span>{item.location || ({ class: 'Aula', exam: 'Prova', deadline: 'Prazo', personal: 'Pessoal', other: 'Outro' }[item.type])}</span></div></li>)}</ul>}
          </section>
        </div>
        <section className="dashboard-panel dashboard-focus-strip"><div><span className="card-label">FOCO DE HOJE</span><strong>{focusSummary.todayMinutes} min</strong><span>{focusSummary.today} sessões concluídas · {focusSummary.total} no histórico</span></div><button type="button" className="dashboard-link" onClick={() => onNavigate('produtividade')}>Abrir produtividade →</button></section>
      </>}
    </section>
  );
}
