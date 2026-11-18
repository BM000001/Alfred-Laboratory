import { findAppointmentConflicts, sortAppointmentsByStart } from './agenda/agendaRules';
import type { Appointment } from './agenda/types';
import type { Task } from './tasks/types';
import type { StudyStart } from './Studies';

const dayMs = 86_400_000;

export function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export type StudyResume = StudyStart & { title: string; subject: string; at: string; pending: boolean };

type SuggestionContent = { title: string; detail: string; action: string };
type CalendarSuggestion = SuggestionContent & { kind: 'conflict' | 'overdue' | 'deadline'; date: string };
type StudySuggestion = SuggestionContent & { kind: 'study'; study: StudyResume };
export type TodaySuggestion = CalendarSuggestion | StudySuggestion;

export function getTodaySuggestions(
  tasks: Task[],
  appointments: Appointment[],
  resume: StudyResume | undefined,
  now: Date,
): TodaySuggestion[] {
  const suggestions: TodaySuggestion[] = [];
  const today = localDateKey(now);
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 3);
  const through = localDateKey(soon);
  const horizon = now.getTime() + 2 * dayMs;
  const upcoming = sortAppointmentsByStart(appointments.filter((item) =>
    item.status === 'scheduled' && !item.isAllDay && Date.parse(item.endsAt) > now.getTime()
    && Date.parse(item.startsAt) < horizon && Date.parse(item.endsAt) > Date.parse(item.startsAt)));
  // Finding the first adjacent overlap is enough after sorting by start time.
  const conflictAt = upcoming.findIndex((item, index) =>
    upcoming[index + 1] && findAppointmentConflicts([upcoming[index + 1]], item).length > 0);

  if (conflictAt >= 0) {
    const [first, second] = upcoming.slice(conflictAt, conflictAt + 2);
    const overlap = new Date(Math.max(now.getTime(), Date.parse(second.startsAt)));
    suggestions.push({
      kind: 'conflict', title: 'Revise um conflito na agenda',
      detail: `“${first.title}” e “${second.title}” ocupam parte do mesmo horário.`,
      action: 'Ver conflito no calendário', date: localDateKey(overlap),
    });
  }

  const importantTasks = tasks.filter((task) => task.status === 'pending' && task.priority === 'high' && task.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id.localeCompare(b.id));
  const overdue = importantTasks.find((task) => task.dueDate! < today);
  if (overdue?.dueDate) {
    suggestions.push({
      kind: 'overdue', title: 'Replaneje uma tarefa importante',
      detail: 'Revise o prazo da tarefa de alta prioridade que está atrasada há mais tempo.',
      action: 'Ver tarefas da data original', date: overdue.dueDate,
    });
  }

  const deadline = importantTasks.find((task) => task.dueDate! > today && task.dueDate! <= through);
  if (deadline?.dueDate) {
    const label = new Date(deadline.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    suggestions.push({
      kind: 'deadline', title: 'Reserve tempo para um prazo próximo',
      detail: `“${deadline.title}” é de alta prioridade e vence em ${label}.`,
      action: 'Ver tarefas do prazo', date: deadline.dueDate,
    });
  }

  if (resume?.pending && now.getTime() - Date.parse(resume.at) >= 3 * dayMs) {
    suggestions.push({
      kind: 'study', title: 'Retome um estudo em andamento',
      detail: `“${resume.title}” continua pendente e sua última atividade foi há pelo menos três dias.`,
      action: 'Retomar estudo', study: resume,
    });
  }

  return suggestions.slice(0, 2);
}
