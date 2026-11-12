import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarGrid, calendarDays, eventsOnDate, localDateKey } from './CalendarGrid';
import type { Appointment } from './types';
const event: Appointment = { id: 'overnight', title: 'Evento de dois dias', type: 'personal', status: 'scheduled', startsAt: '2026-11-10T23:00:00', endsAt: '2026-11-11T01:00:00', createdAt: '2026-11-01T00:00:00' };
describe('calendar grids', () => {
  it('includes all seven local dates across a year boundary', () => {
    const days = calendarDays(new Date(2026, 0, 1), 'week');
    expect(days).toHaveLength(7); expect(localDateKey(days[0])).toBe('2025-12-28'); expect(localDateKey(days[6])).toBe('2026-01-03');
  });
  it('shows spanning events on both days but excludes cancelled events and the exclusive end', () => {
    expect(eventsOnDate([event], new Date(2026, 10, 11))).toHaveLength(1);
    expect(eventsOnDate([{ ...event, endsAt: '2026-11-11T00:00:00' }], new Date(2026, 10, 11))).toHaveLength(0);
    expect(eventsOnDate([{ ...event, status: 'cancelled' }], new Date(2026, 10, 10))).toHaveLength(0);
  });
  it('opens an event from the week and drills into a month from the year', () => {
    const onEvent = vi.fn(), onDate = vi.fn();
    const { rerender } = render(<CalendarGrid date="2026-11-11" view="week" items={[event]} onEvent={onEvent} onDate={onDate} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Evento de dois dias/ })[0]); expect(onEvent).toHaveBeenCalledWith(event);
    rerender(<CalendarGrid date="2026-11-11" view="year" items={[event]} onEvent={onEvent} onDate={onDate} />);
    fireEvent.click(screen.getByRole('button', { name: 'fevereiro' })); expect(onDate).toHaveBeenCalledWith('2026-02-01', 'month');
  });
});
