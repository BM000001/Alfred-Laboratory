import type { Task } from './tasks/types';
import type { Appointment } from './agenda/types';

export type BriefingItem = {
  id: string; kind: 'task' | 'appointment'; title: string; reason: string;
  urgency: number; target: 'tarefas' | 'agenda';
};

function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function daysBetween(dateKey: string, now: Date): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** Produces recommendations only; never mutates persisted records. */
export function buildDailyBriefing(tasks: Task[], appointments: Appointment[], now = new Date()): BriefingItem[] {
  const tomorrow = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const today = localDateKey(now);
  const items: BriefingItem[] = [];
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    const days = task.dueDate ? daysBetween(task.dueDate, now) : null;
    const overdue = days !== null && days < 0;
    const soon = days !== null && days <= 2;
    if (!overdue && !soon && task.priority !== 'high') continue;
    items.push({
      id: `task:${task.id}`, kind: 'task', title: task.title, target: 'tarefas',
      reason: overdue ? 'Prazo vencido' : days === 0 ? 'Prazo hoje' : days !== null && days > 0 ? `Prazo em ${days} dia(s)` : 'Prioridade alta',
      urgency: overdue ? 0 : days === 0 ? 1 : soon ? 2 : 3,
    });
  }
  for (const appointment of appointments) {
    if (appointment.status !== 'scheduled') continue;
    const start = Date.parse(appointment.startsAt);
    if (!Number.isFinite(start) || start < now.getTime()) continue;
    const date = localDateKey(new Date(start));
    if (date !== today && date !== tomorrow) continue;
    items.push({
      id: `appointment:${appointment.id}`, kind: 'appointment', title: appointment.title,
      target: 'agenda', reason: date === today ? 'Compromisso de hoje' : 'Compromisso de amanhã',
      urgency: date === today ? 2 : 4,
    });
  }
  return items.sort((a, b) => a.urgency - b.urgency || a.title.localeCompare(b.title, 'pt-BR')).slice(0, 6);
}
