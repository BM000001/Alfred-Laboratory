import type { Appointment } from './types';

export interface ICalendarImportItem {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
  allDay: boolean;
}

export interface ICalendarParseResult {
  events: ICalendarImportItem[];
  warnings: string[];
}

function unfoldLines(source: string): string[] {
  return source.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const separator = line.indexOf(':');
  if (separator < 1) return null;
  const [namePart, ...rest] = line.slice(0, separator).split(';');
  const params: Record<string, string> = {};
  for (const part of rest) {
    const index = part.indexOf('=');
    if (index > 0) params[part.slice(0, index).toUpperCase()] = part.slice(index + 1).replace(/^"|"$/g, '');
  }
  return { name: namePart.toUpperCase(), params, value: line.slice(separator + 1) };
}

function zonedDate(parts: number[], timeZone?: string): Date | null {
  const [year, month, day, hour = 0, minute = 0, second = 0] = parts;
  if (!timeZone) {
    const date = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  try {
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = target;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const fields = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, Number(part.value)]));
      const represented = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
      guess += target - represented;
    }
    return new Date(guess);
  } catch {
    return null;
  }
}

function parseDate(property: ReturnType<typeof parseProperty>): Date | null {
  if (!property) return null;
  const raw = property.value;
  if (/^\d{8}$/.test(raw)) {
    const values = raw.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/);
    return values ? zonedDate(values.slice(1).map(Number)) : null;
  }
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const parts = match.slice(1, 7).filter(Boolean).map(Number);
  if (match[7]) return new Date(Date.UTC(...parts as [number, number, number, number, number, number]));
  return zonedDate(parts, property.params.TZID);
}

export function parseICalendar(source: string): ICalendarParseResult {
  const lines = unfoldLines(source);
  const events: ICalendarImportItem[] = [];
  const warnings: string[] = [];
  let current: Record<string, ReturnType<typeof parseProperty>> | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line.toUpperCase() === 'END:VEVENT') {
      if (!current) continue;
      const uid = current.UID?.value;
      const title = current.SUMMARY?.value;
      const start = parseDate(current.DTSTART);
      const end = parseDate(current.DTEND);
      if (current.STATUS?.value.toUpperCase() === 'CANCELLED') {
        warnings.push('Um evento cancelado foi ignorado.');
      } else if (current.RRULE || current['RECURRENCE-ID']) {
        warnings.push(`O evento recorrente "${title ? unescapeText(title) : 'sem título'}" foi ignorado; séries recorrentes ainda não são expandidas.`);
      } else if (!uid || !title || !start || !end || end <= start) {
        warnings.push('Um evento com dados ausentes, data inválida ou fuso não reconhecido foi ignorado.');
      } else {
        events.push({
          uid,
          title: unescapeText(title),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          ...(current.LOCATION?.value ? { location: unescapeText(current.LOCATION.value) } : {}),
          ...(current.DESCRIPTION?.value ? { description: unescapeText(current.DESCRIPTION.value) } : {}),
          allDay: current.DTSTART?.params.VALUE === 'DATE' || /^\d{8}$/.test(current.DTSTART?.value ?? ''),
        });
      }
      current = null;
      continue;
    }
    if (current) {
      const property = parseProperty(line);
      if (property) current[property.name] = property;
    }
  }
  if (events.length === 0 && warnings.length === 0) warnings.push('Nenhum evento compatível foi encontrado no arquivo.');
  return { events, warnings };
}

export function findICalendarDuplicates(
  imported: ICalendarImportItem[],
  existing: Appointment[],
): ICalendarImportItem[] {
  const known = new Set(existing.map((item) => (item as Appointment & { importedUid?: string }).importedUid).filter(Boolean));
  return imported.filter((item) => !known.has(item.uid));
}
