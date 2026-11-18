import { useEffect, useState } from 'react';
import type { Appointment } from './agenda/types';
import type { Task } from './tasks/types';
import type { StudyStart } from './Studies';
import { appointmentRepository, disciplineRepository, studyFlashcardRepository, studyLearningProgressRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository, taskRepository } from '../storage/repositories';
import { isTaskOverdue } from './tasks/taskRules';
import { sortAppointmentsByStart } from './agenda/agendaRules';
import { TodayWeather } from './TodayWeather';
import { getTodaySuggestions, localDateKey as dateKey, type StudyResume } from './todaySuggestions';

type Activity = StudyStart & { at: string };

function appointmentTime(item: Appointment) {
  const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return item.isAllDay ? 'Dia inteiro' : `${time(item.startsAt)}–${time(item.endsAt)}`;
}

async function loadResume(): Promise<StudyResume | undefined> {
  const [topics, disciplines, cards, attempts, questions, progress] = await Promise.all([
    studyTopicRepository.getAll(), disciplineRepository.getAll(), studyFlashcardRepository.getAll(),
    studyQuizAttemptRepository.getAll(), studyQuestionRepository.getAll(), studyLearningProgressRepository.getAll(),
  ]);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const subjects = new Map(disciplines.map((discipline) => [discipline.id, discipline.name]));
  const cardByLesson = new Map(cards.map((card) => ['lesson:' + card.id, card]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const activity: Activity[] = [];
  for (const topic of topics) {
    if (topic.sourceFileId || topic.status === 'completed') {
      activity.push({ disciplineId: topic.disciplineId, unitId: topic.id, at: topic.createdAt, view: 'materiais' });
    }
  }
  for (const card of cards) if (card.lastReviewedAt) {
    activity.push({ disciplineId: card.disciplineId, unitId: card.topicId ?? '', at: card.lastReviewedAt, view: 'praticar' });
  }
  for (const attempt of attempts) {
    const unitIds = new Set(attempt.answers.map((answer) => answer.questionSnapshot?.topicId ?? questionById.get(answer.questionId)?.topicId));
    const [unit] = unitIds;
    activity.push({ disciplineId: attempt.disciplineId, unitId: unitIds.size === 1 ? unit ?? '' : '', at: attempt.completedAt, view: 'praticar' });
  }
  for (const item of progress) {
    const card = cardByLesson.get(item.lessonId);
    if (card?.disciplineId !== item.disciplineId) continue;
    activity.push({ disciplineId: item.disciplineId, unitId: card.topicId ?? '', at: item.completedAt, view: 'aprender' });
  }

  for (const entry of activity.sort((a, b) => b.at.localeCompare(a.at))) {
    const subject = subjects.get(entry.disciplineId);
    if (!subject) continue;
    const topic = topicById.get(entry.unitId);
    if (!entry.unitId || topic?.disciplineId === entry.disciplineId) {
      return { ...entry, subject, title: topic?.title ?? subject, pending: topic?.status === 'pending' };
    }
  }
}

export function Overview({ greeting, onCalendar, onAssistant, onResumeStudy, revision }: {
  greeting: string; onCalendar: (date?: string) => void; onAssistant: () => void; onResumeStudy: (start: StudyStart) => void; revision: number;
}) {
  const [routine, setRoutine] = useState<{ tasks: Task[]; appointments: Appointment[] }>();
  const [resume, setResume] = useState<StudyResume>();
  const [error, setError] = useState('');
  const [studyError, setStudyError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([taskRepository.getAll(), appointmentRepository.getAll()]).then(([tasks, appointments]) => {
      if (active) { setRoutine({ tasks, appointments }); setError(''); }
    }).catch(() => { if (active) setError('Não foi possível abrir o resumo local.'); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    loadResume().then((value) => { if (active) setResume(value); })
      .catch(() => { if (active) setStudyError('Não foi possível consultar a atividade recente de estudos.'); });
    return () => { active = false; };
  }, [revision]);

  const now = new Date();
  const today = dateKey(now);
  const appointments = sortAppointmentsByStart((routine?.appointments ?? []).filter((item) => item.status === 'scheduled' && new Date(item.endsAt) > now));
  const todayAppointments = appointments.filter((item) => dateKey(new Date(item.startsAt)) <= today);
  const preparation = todayAppointments.filter((item) => item.type === 'exam' || item.type === 'deadline');
  const priorities = (routine?.tasks ?? []).filter((task) => task.status === 'pending' && (isTaskOverdue(task, now) || task.dueDate === today))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const regular = todayAppointments.filter((item) => !preparation.includes(item));
  const agenda = regular.length ? regular : appointments.slice(0, 1).filter((item) => !preparation.includes(item));
  const date = now.toLocaleDateString('pt-BR', { dateStyle: 'full' });
  const suggestions = getTodaySuggestions(routine?.tasks ?? [], routine?.appointments ?? [], resume, now);
  const suggestsStudy = suggestions.some((item) => item.kind === 'study');

  return <section className="daily-brief" aria-label="Resumo do Alfred">
    <header className="day-hero">
      <div><p className="day-date">{date}</p><h1>{greeting}</h1></div>
      <TodayWeather />
    </header>
    {error ? <p className="module-error" role="alert">{error}</p> : !routine ? <p role="status">Reunindo sua rotina…</p> : <>
      {(priorities.length > 0 || preparation.length > 0) && <section className="brief-feature today-priorities" aria-labelledby="today-priorities">
        <h2 id="today-priorities">Prioridades</h2>
        <ul className="brief-list">
          {priorities.slice(0, 4).map((task) => <li key={task.id}><strong>{task.title}</strong><small className={isTaskOverdue(task, now) ? 'brief-overdue' : undefined}>{isTaskOverdue(task, now) ? 'Em atraso' : 'Vence hoje'}</small></li>)}
          {preparation.slice(0, 3).map((item) => <li key={item.id}><strong>{item.title}</strong><small>{item.type === 'exam' ? 'Prova' : 'Prazo'} · {appointmentTime(item)}</small></li>)}
        </ul>
      </section>}
      <section className="brief-panel today-agenda" aria-labelledby="today-agenda">
        <div className="section-heading">
          <h2 id="today-agenda">{regular.length ? 'Agenda de hoje' : agenda.length ? 'Próximo compromisso' : 'Agenda'}</h2>
          <button className="text-action" type="button" onClick={() => onCalendar()}>Abrir calendário</button>
        </div>
        {agenda.length ? <ul className="brief-list">{agenda.slice(0, 4).map((item) => <li key={item.id}>
          <strong>{item.title}</strong><small>{dateKey(new Date(item.startsAt)) > today ? new Date(item.startsAt).toLocaleDateString('pt-BR') + ' · ' : ''}{appointmentTime(item)}{item.location && ' · ' + item.location}</small>
        </li>)}</ul> : <p>{preparation.length ? 'Sem outros compromissos hoje.' : 'Nenhum compromisso futuro na agenda.'}</p>}
      </section>
    </>}
    {studyError && <p role="status">{studyError}</p>}
    {resume && !suggestsStudy && <section className="brief-panel" aria-labelledby="today-study">
      <h2 id="today-study">Continuar estudando</h2>
      <div className="brief-resume"><div><strong>{resume.title}</strong>{resume.title !== resume.subject && <p>{resume.subject}</p>}</div>
        <button className="secondary-action" type="button" onClick={() => onResumeStudy(resume)}>Retomar estudo</button></div>
    </section>}
    {suggestions.length ? <section className="brief-panel today-suggestions" aria-labelledby="today-suggestions">
      <h2 id="today-suggestions">Sugestões do Alfred</h2>
      <ul className="brief-list">{suggestions.map((item) => <li key={item.kind}>
        <div><strong>{item.title}</strong><p>{item.detail}</p></div>
        <button className="text-action" type="button" onClick={() => {
          if (item.kind === 'study') onResumeStudy(item.study);
          else onCalendar(item.date);
        }}>{item.action}</button>
      </li>)}</ul>
    </section> : <button className="text-action today-assistant" type="button" onClick={onAssistant}>Conversar com Alfred</button>}
  </section>;
}
