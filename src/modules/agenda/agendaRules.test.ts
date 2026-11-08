import { describe, expect, it } from 'vitest';
import type { Appointment } from './types';
import { classifyImportedAppointment, findAppointmentConflicts, sortAppointmentsByStart, validateAppointment } from './agendaRules';

const first: Appointment = {
  id: 'a1',
  title: 'Aula de programação',
  type: 'class',
  status: 'scheduled',
  startsAt: '2026-11-03T08:00:00.000-03:00',
  endsAt: '2026-11-03T09:30:00.000-03:00',
  createdAt: '2026-11-02T12:00:00.000Z',
};

describe('agendaRules', () => {
  it('classifies imported calendar events from Portuguese titles, including accents and plurals', () => {
    expect(classifyImportedAppointment('Prova de Matemática')).toBe('exam');
    expect(classifyImportedAppointment('Avaliação final')).toBe('exam');
    expect(classifyImportedAppointment('Avaliações finais')).toBe('exam');
    expect(classifyImportedAppointment('Aula de programação')).toBe('class');
    expect(classifyImportedAppointment('Aulas de programação')).toBe('class');
    expect(classifyImportedAppointment('Entrega do trabalho final')).toBe('deadline');
    expect(classifyImportedAppointment('Inscrições abertas')).toBe('deadline');
    expect(classifyImportedAppointment('Consulta com dentista')).toBe('personal');
    expect(classifyImportedAppointment('Viagem de estudos')).toBe('personal');
    expect(classifyImportedAppointment('Reunião com equipe')).toBe('other');
  });

  it('matches complete normalized words, not substrings inside unrelated words', () => {
    expect(classifyImportedAppointment('Provação de conceito')).toBe('other');
    expect(classifyImportedAppointment('Reprovado na avaliação')).toBe('exam');
    expect(classifyImportedAppointment('Viagens acadêmicas')).toBe('personal');
  });

  it('requires a title and a valid time range', () => {
    expect(validateAppointment({ title: ' ', startsAt: first.startsAt, endsAt: first.endsAt }))
      .toBe('O título do compromisso é obrigatório.');
    expect(validateAppointment({ title: 'Aula', startsAt: first.startsAt, endsAt: first.startsAt }))
      .toBe('O horário de término deve ser posterior ao início.');
  });

  it('detects overlapping appointments but allows events that touch at the boundary', () => {
    const overlapping = { ...first, id: 'a2', startsAt: '2026-11-03T09:00:00.000-03:00', endsAt: '2026-11-03T10:00:00.000-03:00' };
    const adjacent = { ...first, id: 'a3', startsAt: '2026-11-03T09:30:00.000-03:00', endsAt: '2026-11-03T10:30:00.000-03:00' };

    expect(findAppointmentConflicts([first], overlapping)).toEqual([first]);
    expect(findAppointmentConflicts([first], adjacent)).toEqual([]);
  });

  it('ignores the same appointment and cancelled appointments', () => {
    const cancelled = { ...first, id: 'a2', status: 'cancelled' as const };
    expect(findAppointmentConflicts([first, cancelled], first)).toEqual([]);
  });

  it('sorts appointments chronologically without mutating the original list', () => {
    const later = { ...first, id: 'a2', startsAt: '2026-11-03T12:00:00.000-03:00' };
    const input = [later, first];
    expect(sortAppointmentsByStart(input).map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(input[0].id).toBe('a2');
  });
});
