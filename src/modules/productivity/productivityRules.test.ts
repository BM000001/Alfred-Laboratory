import { describe, expect, it } from 'vitest';
import { summarizeFocusSessions } from './productivityRules';
import type { FocusSession } from './types';

const session = (id: string, completedAt: string, durationMinutes = 25): FocusSession => ({
  id, startedAt: completedAt, completedAt, durationMinutes, kind: 'focus',
});

describe('summarizeFocusSessions', () => {
  it('counts only sessions completed today', () => {
    const result = summarizeFocusSessions([
      session('a', '2026-11-02T10:00:00.000Z'),
      session('b', '2026-11-02T11:00:00.000Z'),
      session('c', '2026-11-01T11:00:00.000Z', 30),
    ], new Date('2026-11-02T15:00:00.000Z'), 'UTC');
    expect(result.today).toBe(2);
    expect(result.todayMinutes).toBe(50);
    expect(result.total).toBe(3);
  });

  it('orders recent sessions newest first and limits to five', () => {
    const sessions = Array.from({ length: 7 }, (_, index) =>
      session(String(index), `2026-11-02T0${index}:00:00.000Z`));
    const result = summarizeFocusSessions(sessions, new Date('2026-11-02T15:00:00.000Z'), 'UTC');
    expect(result.recent).toHaveLength(5);
    expect(result.recent[0].id).toBe('6');
    expect(result.recent[4].id).toBe('2');
  });

  it('usa o dia local configurado em vez de cortar a data UTC', () => {
    const result = summarizeFocusSessions([
      session('late-local-yesterday', '2026-11-02T02:00:00.000Z'),
      session('early-local-today', '2026-11-02T03:30:00.000Z'),
      session('previous-day', '2026-11-01T02:00:00.000Z'),
    ], new Date('2026-11-02T02:30:00.000Z'), 'America/Sao_Paulo');
    expect(result.today).toBe(1);
    expect(result.todayMinutes).toBe(25);
  });

  it('ignora datas inválidas ao calcular o total de hoje', () => {
    const result = summarizeFocusSessions([
      session('valid', '2026-11-02T10:00:00.000Z'),
      session('invalid', 'not-a-date'),
    ], new Date('2026-11-02T15:00:00.000Z'), 'UTC');
    expect(result.today).toBe(1);
  });
});
