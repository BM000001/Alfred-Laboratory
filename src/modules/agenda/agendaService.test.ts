import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { Appointment } from './types';
import { createAgendaService } from './agendaService';

function createMemoryRepository<T extends { id: string }>(): EntityRepository<T> {
  const records = new Map<string, T>();
  return {
    async getAll() { return [...records.values()]; },
    async getById(id) { return records.get(id); },
    async save(entity) { records.set(entity.id, entity); },
    async delete(id) { records.delete(id); },
    async clear() { records.clear(); },
  };
}

describe('agendaService', () => {
  it('creates an appointment with scheduled status', async () => {
    const service = createAgendaService(createMemoryRepository<Appointment>(), {
      createId: () => 'appointment-1',
      now: () => new Date('2026-11-02T12:00:00.000Z'),
    });
    const appointment = await service.create({
      title: 'Aula de programação',
      type: 'class',
      startsAt: '2026-11-03T08:00:00.000-03:00',
      endsAt: '2026-11-03T09:30:00.000-03:00',
    });

    expect(appointment).toMatchObject({ id: 'appointment-1', status: 'scheduled', type: 'class' });
  });

  it('rejects invalid time ranges', async () => {
    const service = createAgendaService(createMemoryRepository<Appointment>());
    await expect(service.create({
      title: 'Aula',
      type: 'class',
      startsAt: '2026-11-03T09:00:00.000-03:00',
      endsAt: '2026-11-03T08:00:00.000-03:00',
    })).rejects.toThrow('O horário de término deve ser posterior ao início.');
  });

  it('upserts imported calendar events without duplicating them or replacing manual appointments', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: (() => { let id = 0; return () => `event-${++id}`; })() });
    const manual = await service.create({ title: 'Meu compromisso', type: 'personal', startsAt: '2026-11-04T10:00:00.000Z', endsAt: '2026-11-04T11:00:00.000Z' });
    const first = await service.upsertImported({ importedUid: 'apple:stable-1', title: 'Evento Apple', type: 'other', startsAt: '2026-11-04T12:00:00.000Z', endsAt: '2026-11-04T13:00:00.000Z' });
    const second = await service.upsertImported({ importedUid: 'apple:stable-1', title: 'Evento Apple atualizado', type: 'other', startsAt: '2026-11-04T13:00:00.000Z', endsAt: '2026-11-04T14:00:00.000Z' });
    const all = await service.list();
    expect(first.id).toBe(second.id);
    expect(all).toHaveLength(2);
    expect(all.find((item) => item.id === manual.id)?.title).toBe('Meu compromisso');
    expect(all.find((item) => item.id === first.id)).toMatchObject({ title: 'Evento Apple atualizado', importedUid: 'apple:stable-1' });
  });


  it('keeps recurring calendar occurrences as separate appointments across syncs', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, {
      createId: (() => { let id = 0; return () => `recurring-${++id}`; })(),
    });

    // EventKit provides a distinct eventIdentifier for each occurrence.
    // Re-syncing those same identifiers must update, not duplicate, either occurrence.
    const firstOccurrence = await service.upsertImported({
      importedUid: 'apple:series-occurrence-2026-11-05',
      importedCalendarId: 'calendar-classes',
      title: 'Aula recorrente',
      type: 'class',
      startsAt: '2026-11-05T08:00:00.000Z',
      endsAt: '2026-11-05T09:00:00.000Z',
    });
    const secondOccurrence = await service.upsertImported({
      importedUid: 'apple:series-occurrence-2026-11-06',
      importedCalendarId: 'calendar-classes',
      title: 'Aula recorrente',
      type: 'class',
      startsAt: '2026-11-06T08:00:00.000Z',
      endsAt: '2026-11-06T09:00:00.000Z',
    });

    const refreshedFirst = await service.upsertImported({
      importedUid: 'apple:series-occurrence-2026-11-05',
      importedCalendarId: 'calendar-classes',
      title: 'Aula recorrente atualizada',
      type: 'class',
      startsAt: '2026-11-05T08:30:00.000Z',
      endsAt: '2026-11-05T09:30:00.000Z',
    });

    const all = await service.list();
    expect(firstOccurrence.id).not.toBe(secondOccurrence.id);
    expect(refreshedFirst.id).toBe(firstOccurrence.id);
    expect(all).toHaveLength(2);
    expect(all.find((item) => item.id === firstOccurrence.id)?.startsAt).toBe('2026-11-05T08:30:00.000Z');
    expect(all.find((item) => item.id === secondOccurrence.id)?.startsAt).toBe('2026-11-06T08:00:00.000Z');
  });

  it('preserves all-day metadata when importing and updating calendar events', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: () => 'all-day-event' });
    const first = await service.upsertImported({
      importedUid: 'apple:all-day-1',
      importedCalendarId: 'calendar-a',
      title: 'Feriado',
      type: 'personal',
      startsAt: '2026-11-15T00:00:00.000Z',
      endsAt: '2026-11-16T00:00:00.000Z',
      isAllDay: true,
    });
    expect(first.isAllDay).toBe(true);

    const updated = await service.upsertImported({
      importedUid: 'apple:all-day-1',
      importedCalendarId: 'calendar-a',
      title: 'Feriado atualizado',
      type: 'personal',
      startsAt: '2026-11-15T00:00:00.000Z',
      endsAt: '2026-11-16T00:00:00.000Z',
      isAllDay: true,
    });
    expect(updated).toMatchObject({ id: first.id, isAllDay: true, title: 'Feriado atualizado' });
  });

  it('stores and refreshes the source calendar name for imported events', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: () => 'source-calendar-event' });
    const first = await service.upsertImported({
      importedUid: 'apple:source-1',
      importedCalendarId: 'calendar-a',
      importedCalendarName: 'Universidade',
      title: 'Aula de programação',
      type: 'class',
      startsAt: '2026-11-10T08:00:00.000Z',
      endsAt: '2026-11-10T09:00:00.000Z',
    });
    expect(first.importedCalendarName).toBe('Universidade');

    const updated = await service.upsertImported({
      importedUid: 'apple:source-1',
      importedCalendarId: 'calendar-a',
      importedCalendarName: 'Faculdade',
      title: 'Aula de programação',
      type: 'class',
      startsAt: '2026-11-10T08:00:00.000Z',
      endsAt: '2026-11-10T09:00:00.000Z',
    });
    expect(updated).toMatchObject({ id: first.id, importedCalendarName: 'Faculdade' });
  });

  it('preserves recurrence metadata when importing and refreshing Apple events', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: () => 'recurring-event' });
    const first = await service.upsertImported({
      importedUid: 'apple:recurring-1',
      importedCalendarId: 'calendar-a',
      title: 'Aula semanal',
      type: 'class',
      startsAt: '2026-11-09T10:00:00.000Z',
      endsAt: '2026-11-09T11:00:00.000Z',
      isRecurring: true,
    });
    expect(first.isRecurring).toBe(true);

    const refreshed = await service.upsertImported({
      importedUid: 'apple:recurring-1',
      importedCalendarId: 'calendar-a',
      title: 'Aula semanal',
      type: 'class',
      startsAt: '2026-11-09T10:30:00.000Z',
      endsAt: '2026-11-09T11:30:00.000Z',
      isRecurring: false,
    });
    expect(refreshed).toMatchObject({ id: first.id, isRecurring: false });
  });

  it('archives removed Apple events only in the selected source calendar and sync window', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: (() => { let id = 0; return () => `apple-${++id}`; })() });
    const keep = await service.upsertImported({
      importedUid: 'apple:event-1', importedCalendarId: 'calendar-a', title: 'Keep',
      type: 'other', startsAt: '2026-11-05T10:00:00.000Z', endsAt: '2026-11-05T11:00:00.000Z',
    });
    const remove = await service.upsertImported({
      importedUid: 'apple:event-2', importedCalendarId: 'calendar-a', title: 'Removed',
      type: 'other', startsAt: '2026-11-06T10:00:00.000Z', endsAt: '2026-11-06T11:00:00.000Z',
    });
    const otherCalendar = await service.upsertImported({
      importedUid: 'apple:event-3', importedCalendarId: 'calendar-b', title: 'Other calendar',
      type: 'other', startsAt: '2026-11-06T10:00:00.000Z', endsAt: '2026-11-06T11:00:00.000Z',
    });
    const count = await service.reconcileImportedCalendar(
      'calendar-a', [keep.importedUid!], '2026-11-04T00:00:00.000Z', '2026-11-10T00:00:00.000Z',
    );
    expect(count).toBe(1);
    expect((await service.get(keep.id))?.status).toBe('scheduled');
    expect((await service.get(remove.id))?.status).toBe('cancelled');
    expect((await service.get(otherCalendar.id))?.status).toBe('scheduled');
  });

  it('does not archive imported events outside the exact completed snapshot range', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: () => 'snapshot-range-event' });
    const appointment = await service.upsertImported({
      importedUid: 'apple:outside-range',
      importedCalendarId: 'calendar-a',
      title: 'Compromisso futuro',
      type: 'other',
      startsAt: '2026-12-15T10:00:00.000Z',
      endsAt: '2026-12-15T11:00:00.000Z',
    });

    const count = await service.reconcileImportedCalendar(
      'calendar-a', [], '2026-11-04T00:00:00.000Z', '2026-12-04T00:00:00.000Z',
    );
    expect(count).toBe(0);
    expect((await service.get(appointment.id))?.status).toBe('scheduled');
    await expect(service.reconcileImportedCalendar(
      'calendar-a', [], 'invalid', '2026-12-04T00:00:00.000Z',
    )).rejects.toThrow('Intervalo inválido');
  });

  it('keeps the same Alfred appointment when EventKit changes an event ID after a calendar move', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: (() => { let id = 0; return () => `stable-${++id}`; })() });
    const first = await service.upsertImported({
      importedUid: 'apple:old-event-id',
      importedStableUid: 'apple-stable:server-event-42:single',
      importedCalendarId: 'calendar-personal',
      title: 'Consulta',
      type: 'personal',
      startsAt: '2026-11-12T10:00:00.000Z',
      endsAt: '2026-11-12T11:00:00.000Z',
    });

    const moved = await service.upsertImported({
      importedUid: 'apple:new-event-id',
      importedStableUid: 'apple-stable:server-event-42:single',
      importedCalendarId: 'calendar-work',
      importedCalendarName: 'Trabalho',
      title: 'Consulta remarcada',
      type: 'personal',
      startsAt: '2026-11-12T14:00:00.000Z',
      endsAt: '2026-11-12T15:00:00.000Z',
    });

    expect(moved.id).toBe(first.id);
    expect(await service.list()).toHaveLength(1);
    expect(moved).toMatchObject({
      importedUid: 'apple:new-event-id',
      importedStableUid: 'apple-stable:server-event-42:single',
      importedCalendarId: 'calendar-work',
      importedCalendarName: 'Trabalho',
      title: 'Consulta remarcada',
    });
  });

  it('does not merge duplicate external copies when stable identity is ambiguous', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: (() => { let id = 0; return () => `copy-${++id}`; })() });
    await service.upsertImported({
      importedUid: 'apple:copy-a',
      importedStableUid: 'apple-stable:shared-server-id:single',
      importedCalendarId: 'calendar-a',
      title: 'Evento compartilhado',
      type: 'other',
      startsAt: '2026-11-12T10:00:00.000Z',
      endsAt: '2026-11-12T11:00:00.000Z',
    });
    await service.upsertImported({
      importedUid: 'apple:copy-b',
      importedStableUid: 'apple-stable:shared-server-id:single',
      importedCalendarId: 'calendar-b',
      title: 'Evento compartilhado',
      type: 'other',
      startsAt: '2026-11-12T10:00:00.000Z',
      endsAt: '2026-11-12T11:00:00.000Z',
    });

    const changed = await service.upsertImported({
      importedUid: 'apple:copy-c',
      importedStableUid: 'apple-stable:shared-server-id:single',
      importedCalendarId: 'calendar-c',
      title: 'Cópia em outro calendário',
      type: 'other',
      startsAt: '2026-11-12T12:00:00.000Z',
      endsAt: '2026-11-12T13:00:00.000Z',
    });

    expect(await service.list()).toHaveLength(3);
    expect(changed.id).toBe('copy-3');
  });

  it('uses the original occurrence date to keep recurring events distinct after edits', async () => {
    const repository = createMemoryRepository<Appointment>();
    const service = createAgendaService(repository, { createId: (() => { let id = 0; return () => `occurrence-${++id}`; })() });
    const first = await service.upsertImported({
      importedUid: 'apple:occurrence-a',
      importedStableUid: 'apple-stable:series-7:2026-11-12T08:00:00.000Z',
      importedCalendarId: 'calendar-classes',
      title: 'Aula semanal',
      type: 'class',
      startsAt: '2026-11-12T08:00:00.000Z',
      endsAt: '2026-11-12T09:00:00.000Z',
      isRecurring: true,
    });
    const second = await service.upsertImported({
      importedUid: 'apple:occurrence-b',
      importedStableUid: 'apple-stable:series-7:2026-11-19T08:00:00.000Z',
      importedCalendarId: 'calendar-classes',
      title: 'Aula semanal',
      type: 'class',
      startsAt: '2026-11-19T08:00:00.000Z',
      endsAt: '2026-11-19T09:00:00.000Z',
      isRecurring: true,
    });
    const editedFirst = await service.upsertImported({
      importedUid: 'apple:detached-occurrence-a',
      importedStableUid: 'apple-stable:series-7:2026-11-12T08:00:00.000Z',
      importedCalendarId: 'calendar-classes',
      title: 'Aula semanal alterada',
      type: 'class',
      startsAt: '2026-11-12T10:00:00.000Z',
      endsAt: '2026-11-12T11:00:00.000Z',
      isRecurring: true,
    });

    expect(editedFirst.id).toBe(first.id);
    expect(second.id).not.toBe(first.id);
    expect(await service.list()).toHaveLength(2);
    expect(editedFirst.startsAt).toBe('2026-11-12T10:00:00.000Z');
  });

  it('cancels and deletes appointments', async () => {
    const service = createAgendaService(createMemoryRepository<Appointment>(), { createId: () => 'appointment-2' });
    const created = await service.create({
      title: 'Prova',
      type: 'exam',
      startsAt: '2026-11-04T10:00:00.000-03:00',
      endsAt: '2026-11-04T11:00:00.000-03:00',
    });
    const cancelled = await service.cancel(created.id);
    expect(cancelled.status).toBe('cancelled');

    await service.delete(created.id);
    expect(await service.get(created.id)).toBeUndefined();
  });
});
