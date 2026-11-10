import type { EntityRepository } from '../../storage/repositories';
import type { Appointment, CreateAppointmentInput, UpdateAppointmentInput } from './types';
import { validateAppointment } from './agendaRules';

export interface AgendaServiceOptions {
  createId?: () => string;
  now?: () => Date;
}

export function createAgendaService(
  repository: EntityRepository<Appointment>,
  options: AgendaServiceOptions = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function update(id: string, changes: UpdateAppointmentInput): Promise<Appointment> {
    const current = await repository.getById(id);
    if (!current) throw new Error('Compromisso não encontrado.');

    const updated: Appointment = { ...current, ...changes };
    const validationError = validateAppointment(updated);
    if (validationError) throw new Error(validationError);

    if (changes.description !== undefined) {
      const description = changes.description.trim();
      if (description) updated.description = description;
      else delete updated.description;
    }
    if (changes.location !== undefined) {
      const location = changes.location.trim();
      if (location) updated.location = location;
      else delete updated.location;
    }

    await repository.save(updated);
    return updated;
  }

  return {
    async list(): Promise<Appointment[]> {
      return repository.getAll();
    },

    async get(id: string): Promise<Appointment | undefined> {
      return repository.getById(id);
    },

    async create(input: CreateAppointmentInput): Promise<Appointment> {
      const validationError = validateAppointment(input);
      if (validationError) throw new Error(validationError);

      const appointment: Appointment = {
        id: createId(),
        title: input.title.trim(),
        type: input.type,
        status: 'scheduled',
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(input.isAllDay ? { isAllDay: true } : {}),
        ...(input.isRecurring ? { isRecurring: true } : {}),
        createdAt: now().toISOString(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.location?.trim() ? { location: input.location.trim() } : {}),
      };

      await repository.save(appointment);
      return appointment;
    },

    async upsertImported(input: CreateAppointmentInput & { importedUid: string; importedStableUid?: string; importedCalendarId?: string; importedCalendarName?: string; externalProvider?: 'google'; externalAccountId?: string; externalCalendarId?: string; externalEventId?: string; externalEtag?: string }): Promise<Appointment> {
      const all = await repository.getAll();
      const exactMatch = all.find((item) => item.importedUid === input.importedUid);
      // Account-scoped external identity lets existing imports migrate safely
      // when the local UID format changes, without colliding across Google accounts.
      const externalMatch = input.externalProvider && input.externalAccountId && input.externalCalendarId && input.externalEventId
        ? all.find((item) => item.externalProvider === input.externalProvider &&
            item.externalAccountId === input.externalAccountId &&
            item.externalCalendarId === input.externalCalendarId &&
            item.externalEventId === input.externalEventId)
        : undefined;
      const stableMatches = input.importedStableUid
        ? all.filter((item) => item.importedStableUid === input.importedStableUid)
        : [];
      // Prefer the exact EventKit occurrence ID. If it changed (for example,
      // after moving an event), migrate only when the stable external identity
      // resolves unambiguously. Never merge two copied calendar entries.
      const sameCalendarMatches = stableMatches.filter((item) => item.importedCalendarId === input.importedCalendarId);
      const onlyCrossCalendarMatch = sameCalendarMatches.length === 0 && stableMatches.length === 1
        ? stableMatches[0]
        : undefined;
      // A changed EventKit ID plus a different calendar is not enough to prove
      // that an event moved: it may be a second calendar copy. Only migrate the
      // stable identity across calendars when event details also changed.
      const looksLikeMovedEvent = onlyCrossCalendarMatch !== undefined && (
        onlyCrossCalendarMatch.title !== input.title.trim() ||
        onlyCrossCalendarMatch.startsAt !== input.startsAt ||
        onlyCrossCalendarMatch.endsAt !== input.endsAt
      );
      const stableMatch = sameCalendarMatches.length === 1
        ? sameCalendarMatches[0]
        : looksLikeMovedEvent
          ? onlyCrossCalendarMatch
          : undefined;
      const existing = exactMatch ?? externalMatch ?? stableMatch;
      if (existing) {
        const updated: Appointment = {
          ...existing,
          title: input.title.trim(),
          type: input.type,
          status: 'scheduled',
          importedUid: input.importedUid,
          ...(input.importedStableUid ? { importedStableUid: input.importedStableUid } : {}),
          importedCalendarId: input.importedCalendarId ?? existing.importedCalendarId,
          importedCalendarName: input.importedCalendarName ?? existing.importedCalendarName,
          externalProvider: input.externalProvider ?? existing.externalProvider,
          externalAccountId: input.externalAccountId ?? existing.externalAccountId,
          externalCalendarId: input.externalCalendarId ?? existing.externalCalendarId,
          externalEventId: input.externalEventId ?? existing.externalEventId,
          externalEtag: input.externalEtag ?? existing.externalEtag,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          ...(input.isAllDay ? { isAllDay: true } : { isAllDay: false }),
          ...(input.isRecurring ? { isRecurring: true } : { isRecurring: false }),
          ...(input.location?.trim() ? { location: input.location.trim() } : {}),
        };
        if (!input.location?.trim()) delete updated.location;
        if (input.description?.trim()) updated.description = input.description.trim();
        else delete updated.description;
        const validationError = validateAppointment(updated);
        if (validationError) throw new Error(validationError);
        await repository.save(updated);
        return updated;
      }
      const validationError = validateAppointment(input);
      if (validationError) throw new Error(validationError);
      const imported: Appointment = {
        id: createId(),
        title: input.title.trim(),
        type: input.type,
        status: 'scheduled',
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(input.isAllDay ? { isAllDay: true } : {}),
        ...(input.isRecurring ? { isRecurring: true } : {}),
        createdAt: now().toISOString(),
        importedUid: input.importedUid,
        ...(input.importedStableUid ? { importedStableUid: input.importedStableUid } : {}),
        ...(input.importedCalendarId ? { importedCalendarId: input.importedCalendarId } : {}),
        ...(input.importedCalendarName ? { importedCalendarName: input.importedCalendarName } : {}),
        ...(input.externalProvider ? { externalProvider: input.externalProvider } : {}),
        ...(input.externalAccountId ? { externalAccountId: input.externalAccountId } : {}),
        ...(input.externalCalendarId ? { externalCalendarId: input.externalCalendarId } : {}),
        ...(input.externalEventId ? { externalEventId: input.externalEventId } : {}),
        ...(input.externalEtag ? { externalEtag: input.externalEtag } : {}),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.location?.trim() ? { location: input.location.trim() } : {}),
      };
      await repository.save(imported);
      return imported;
    },


    async reconcileImportedCalendar(calendarId: string, seenImportedUids: string[], from: string, to: string): Promise<number> {
      const seen = new Set(seenImportedUids);
      const start = Date.parse(from);
      const end = Date.parse(to);
      if (!calendarId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new Error('Intervalo inválido para reconciliar o Calendário Apple.');
      }
      let cancelled = 0;
      for (const item of await repository.getAll()) {
        if (item.importedCalendarId !== calendarId || !item.importedUid || item.status === 'cancelled') continue;
        const eventStart = Date.parse(item.startsAt);
        if (!Number.isFinite(eventStart) || eventStart < start || eventStart >= end || seen.has(item.importedUid)) continue;
        await repository.save({ ...item, status: 'cancelled' });
        cancelled += 1;
      }
      return cancelled;
    },

    update,

    async cancel(id: string): Promise<Appointment> {
      return update(id, { status: 'cancelled' });
    },

    async delete(id: string): Promise<void> {
      const current = await repository.getById(id);
      if (!current) throw new Error('Compromisso não encontrado.');
      await repository.delete(id);
    },
  };
}
