import { expect, it } from 'vitest';
import type { Appointment } from './agenda/types';
import type { Task } from './tasks/types';
import { getTodaySuggestions, type StudyResume } from './todaySuggestions';

const now = new Date(2026, 10, 18, 12);
const study: StudyResume = {
  title: 'Metodologia', subject: 'Pesquisa', pending: true,
  at: new Date(2026, 10, 14, 12).toISOString(), disciplineId: 'research', unitId: 'unit', view: 'praticar',
};

function task(dueDate: string, changes: Partial<Task> = {}): Task {
  return { id: dueDate, title: 'Entregar análise', dueDate, priority: 'high', status: 'pending', createdAt: now.toISOString(), ...changes };
}

function event(id: string, start: string, end: string, changes: Partial<Appointment> = {}): Appointment {
  return { id, title: id, type: 'class', status: 'scheduled', startsAt: start, endsAt: end, createdAt: now.toISOString(), ...changes };
}

it('prioriza conflito e atraso, com um item por tipo e no máximo duas sugestões', () => {
  const appointments = [
    event('Aula', '2026-11-19T09:00', '2026-11-19T10:00'),
    event('Revisão', '2026-11-19T09:30', '2026-11-19T11:00'),
    event('Reunião', '2026-11-19T09:45', '2026-11-19T10:15'),
  ];
  const suggestions = getTodaySuggestions([task('2026-11-17'), task('2026-11-15'), task('2026-11-20')], appointments, study, now);
  expect(suggestions).toMatchObject([{ kind: 'conflict', date: '2026-11-19' }, { kind: 'overdue', date: '2026-11-15' }]);
  expect(suggestions[0].detail).toMatch(/Aula.*Revisão/);
});

it('abre o dia de um prazo importante ou retoma o estudo no contexto existente', () => {
  expect(getTodaySuggestions([task('2026-11-21')], [], study, now)).toMatchObject([
    { kind: 'deadline', date: '2026-11-21' }, { kind: 'study', study: { disciplineId: 'research', unitId: 'unit', view: 'praticar' } },
  ]);
});

it('ignora eventos encerrados ou de dia inteiro, horários contíguos e tarefas sem urgência complementar', () => {
  const appointments = [
    event('Base', '2026-11-19T09:00', '2026-11-19T10:00'),
    event('Contíguo', '2026-11-19T10:00', '2026-11-19T11:00'),
    event('Cancelado', '2026-11-19T09:20', '2026-11-19T09:50', { status: 'cancelled' }),
    event('Dia inteiro', '2026-11-19T00:00', '2026-11-20T00:00', { isAllDay: true }),
    event('Passado A', '2026-11-18T08:00', '2026-11-18T09:00'),
    event('Passado B', '2026-11-18T08:30', '2026-11-18T10:00'),
  ];
  expect(getTodaySuggestions([
    task('2026-11-18'), task('2026-11-17', { priority: 'low' }), task('2026-11-17', { status: 'completed' }),
    task('2026-11-22'),
  ], appointments, { ...study, pending: false }, now)).toEqual([]);
});
