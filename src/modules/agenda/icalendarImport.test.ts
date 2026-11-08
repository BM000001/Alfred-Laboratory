import { describe, expect, it } from 'vitest';
import { findICalendarDuplicates, parseICalendar } from './icalendarImport';

const sample = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:class-1@example.test
DTSTART;TZID=America/Sao_Paulo:20261105T090000
DTEND;TZID=America/Sao_Paulo:20261105T100000
SUMMARY:Aula de programação
LOCATION:Bloco 3\, sala 12
DESCRIPTION:Levar notebook\\nRevisar arrays
END:VEVENT
BEGIN:VEVENT
UID:all-day@example.test
DTSTART;VALUE=DATE:20261106
DTEND;VALUE=DATE:20261107
SUMMARY:Dia de entrega
END:VEVENT
END:VCALENDAR`;

describe('parseICalendar', () => {
  it('lê eventos com fuso, campos escapados e eventos de dia inteiro', () => {
    const result = parseICalendar(sample);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].title).toBe('Aula de programação');
    expect(result.events[0].location).toBe('Bloco 3, sala 12');
    expect(result.events[0].description).toContain('Levar notebook');
    expect(result.events[1].allDay).toBe(true);
  });

  it('ignora recorrências e eventos inválidos com aviso', () => {
    const result = parseICalendar('BEGIN:VEVENT\nUID:x\nRRULE:FREQ=WEEKLY\nDTSTART:20261105T090000Z\nDTEND:20261105T100000Z\nSUMMARY:Reunião\nEND:VEVENT');
    expect(result.events).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it('remove eventos cujo UID já foi importado', () => {
    const parsed = parseICalendar(sample).events;
    const existing = [{ id: '1', importedUid: 'class-1@example.test' }] as never;
    expect(findICalendarDuplicates(parsed, existing)).toHaveLength(1);
  });
});
