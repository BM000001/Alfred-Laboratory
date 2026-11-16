import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleCalendarClient, GOOGLE_SCOPES, normalizeGoogleEvent } from './googleCalendar';

const calendar = { id: 'calendar@example.invalid', summary: 'Estudos' };
function authorize(client: ReturnType<typeof createGoogleCalendarClient>) {
  window.google = { accounts: { oauth2: {
    initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token', expires_in: 3600, scope: GOOGLE_SCOPES }) }),
    revoke: (_token, callback) => callback({ successful: true }),
  } } };
  return client.connect('public-client.apps.googleusercontent.com');
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
afterEach(() => { delete window.google; vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Google Calendar web client', () => {
  it('keeps calendar copies distinct and expands recurrence metadata without private notes', () => {
    const event = { id: 'occurrence-1', summary: 'Aula', description: 'private', recurringEventId: 'series', start: { dateTime: '2026-11-12T10:00:00-03:00' }, end: { dateTime: '2026-11-12T11:00:00-03:00' } };
    const first = normalizeGoogleEvent(event, calendar)!;
    expect(first.isRecurring).toBe(true);
    expect(first.type).toBe('class');
    expect(first).not.toHaveProperty('description');
    expect(first.importedCalendarId).toBe(`google:${calendar.id}`);
    expect(normalizeGoogleEvent(event, { ...calendar, id: 'other' })!.importedUid).not.toBe(first.importedUid);
    expect(normalizeGoogleEvent({ status: 'cancelled' }, calendar)).toBeNull();
  });
  it('preserves all-day date boundaries in device local time and rejects malformed events', () => {
    const event = normalizeGoogleEvent({ id: 'day', start: { date: '2026-11-12' }, end: { date: '2026-11-14' } }, calendar)!;
    expect(event.isAllDay).toBe(true);
    expect(new Date(event.startsAt).getDate()).toBe(12);
    expect(new Date(event.startsAt).getHours()).toBe(0);
    expect(new Date(event.endsAt).getDate()).toBe(14);
    expect(() => normalizeGoogleEvent({ id: 'broken' }, calendar)).toThrow('incompletos');
  });
  it('paginates calendars and events, and uses today through 90 days with read-only queries', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [calendar], nextPageToken: 'next' }))
      .mockResolvedValueOnce(json({ items: [{ id: 'other', summary: 'Pessoal' }] }))
      .mockResolvedValueOnce(json({ items: [], nextPageToken: 'events-next' }))
      .mockResolvedValueOnce(json({ items: [{ id: 'one', start: { date: '2026-11-12' }, end: { date: '2026-11-13' } }] }));
    const client = createGoogleCalendarClient(fetcher);
    await authorize(client);
    expect(await client.calendars()).toHaveLength(2);
    const snapshot = await client.snapshot([calendar], new Date(2026, 10, 12, 14));
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.calendarIds).toEqual([`google:${calendar.id}`]);
    expect(new Date(snapshot.from).getHours()).toBe(0);
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('pageToken')).toBe('next');
    const eventUrl = new URL(String(fetcher.mock.calls[2][0]));
    expect(eventUrl.searchParams.get('singleEvents')).toBe('true');
    expect(eventUrl.searchParams.get('fields')).not.toContain('description');
    expect(fetcher.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });
  it('rejects a snapshot if a later calendar fails instead of returning partial results', async () => {
    const client = createGoogleCalendarClient(vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [] }))
      .mockResolvedValueOnce(json({}, 403)));
    await authorize(client);
    await expect(client.snapshot([calendar, { id: 'other', summary: 'Other' }])).rejects.toThrow('recusou');
  });
  it('clears expired and revoked sessions without persisting bearer tokens', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 401));
    const client = createGoogleCalendarClient(fetcher);
    await authorize(client);
    expect(client.connected()).toBe(true);
    await expect(client.calendars()).rejects.toThrow('expirou');
    expect(client.connected()).toBe(false);
    await authorize(client);
    await client.disconnect();
    expect(client.connected()).toBe(false);
    expect(storage).not.toHaveBeenCalled();
    await expect(client.calendars()).rejects.toThrow('expirou');
  });
  it('requires both read permissions and handles a closed popup', async () => {
    const client = createGoogleCalendarClient();
    window.google = { accounts: { oauth2: {
      initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test', scope: 'partial' }) }),
      revoke: vi.fn(),
    } } };
    await expect(client.connect('public-client.apps.googleusercontent.com')).rejects.toThrow('Autorize');
    expect(client.connected()).toBe(false);
    window.google.accounts.oauth2.initTokenClient = config => ({ requestAccessToken: () => config.error_callback() });
    await expect(client.connect('public-client.apps.googleusercontent.com')).rejects.toThrow('bloqueada');
  });
});

describe('Google session lifetime', () => {
  it('requires reconnection after the token lifetime without issuing an API request', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>();
    const client = createGoogleCalendarClient(fetcher);
    await authorize(client);
    vi.advanceTimersByTime(3600 * 1000);
    expect(client.connected()).toBe(false);
    await expect(client.calendars()).rejects.toThrow('expirou');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
