import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { Appointment } from './types';
import { createAgendaService } from './agendaService';
import { findAppointmentConflicts } from './agendaRules';

function memoryRepository(): EntityRepository<Appointment> {
  const records = new Map<string, Appointment>();
  return {
    async getAll() { return [...records.values()]; },
    async getById(id) { return records.get(id); },
    async save(entity) { records.set(entity.id, entity); },
    async delete(id) { records.delete(id); },
    async clear() { records.clear(); },
  };
}

const initial = {
  title: 'Consulta',
  type: 'personal' as const,
  startsAt: '2026-11-10T10:00:00.000Z',
  endsAt: '2026-11-10T11:00:00.000Z',
  location: 'Centro',
  description: 'Levar documentos',
};

describe('agenda editing regressions', () => {
  it('clears optional location and description while preserving the appointment identity', async () => {
    const service = createAgendaService(memoryRepository(), { createId: () => 'appointment-1' });
    const created = await service.create(initial);

    const edited = await service.update(created.id, {
      location: '   ',
      description: '',
      title: 'Consulta remarcada',
    });

    expect(edited.id).toBe(created.id);
    expect(edited.title).toBe('Consulta remarcada');
    expect(edited).not.toHaveProperty('location');
    expect(edited).not.toHaveProperty('description');
    expect(await service.get(created.id)).toEqual(edited);
  });

  it('rejects invalid edits without persisting partial changes', async () => {
    const service = createAgendaService(memoryRepository(), { createId: () => 'appointment-2' });
    const created = await service.create(initial);

    await expect(service.update(created.id, {
      title: 'Mudança inválida',
      startsAt: '2026-11-10T12:00:00.000Z',
      endsAt: '2026-11-10T11:00:00.000Z',
    })).rejects.toThrow('O horário de término deve ser posterior ao início.');

    expect(await service.get(created.id)).toEqual(created);
  });

  it('excludes the edited appointment from conflict detection but blocks overlap with another', async () => {
    let nextId = 0;
    const service = createAgendaService(memoryRepository(), { createId: () => `appointment-${++nextId}` });
    const first = await service.create(initial);
    const second = await service.create({
      title: 'Reunião',
      type: 'other',
      startsAt: '2026-11-10T12:00:00.000Z',
      endsAt: '2026-11-10T13:00:00.000Z',
    });

    expect(findAppointmentConflicts(await service.list(), {
      id: first.id,
      startsAt: first.startsAt,
      endsAt: first.endsAt,
    })).toEqual([]);

    expect(findAppointmentConflicts(await service.list(), {
      id: first.id,
      startsAt: '2026-11-10T12:30:00.000Z',
      endsAt: '2026-11-10T13:30:00.000Z',
    }).map((item) => item.id)).toEqual([second.id]);
  });
});
