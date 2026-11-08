import { describe, expect, it } from 'vitest';
import { buildDailyBriefing } from './dailyBriefing';
import type { Task } from './tasks/types';
import type { Appointment } from './agenda/types';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Entregar trabalho', status: 'pending', priority: 'medium',
  createdAt: '2026-11-01T10:00:00.000Z', ...overrides,
});
const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1', title: 'Aula', type: 'class', status: 'scheduled',
  startsAt: '2026-11-02T15:00:00.000Z', endsAt: '2026-11-02T16:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z', ...overrides,
});

describe('buildDailyBriefing', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');
  it('prioritizes overdue tasks and excludes completed tasks', () => {
    const result = buildDailyBriefing([
      task({ id: 'late', dueDate: '2026-11-01' }),
      task({ id: 'done', status: 'completed', dueDate: '2026-11-01' }),
      task({ id: 'high', priority: 'high' }),
    ], [], now);
    expect(result.map((item) => item.id)).toEqual(['task:late', 'task:high']);
    expect(result[0].reason).toBe('Prazo vencido');
  });
  it('includes due-today tasks and scheduled events today or tomorrow', () => {
    const result = buildDailyBriefing([task({ dueDate: '2026-11-02' })], [
      appointment({ id: 'today' }),
      appointment({ id: 'tomorrow', startsAt: '2026-11-03T15:00:00.000Z', endsAt: '2026-11-03T16:00:00.000Z' }),
      appointment({ id: 'cancelled', status: 'cancelled' }),
    ], now);
    expect(result.map((item) => item.id)).toEqual(['task:t1', 'appointment:today', 'appointment:tomorrow']);
  });
  it('does not mutate source records', () => {
    const source = [task({ dueDate: '2026-11-01' })];
    const before = structuredClone(source);
    buildDailyBriefing(source, [], now);
    expect(source).toEqual(before);
  });
});
