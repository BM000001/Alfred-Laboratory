import { classifyImportedAppointment } from './agendaRules';
import type { CreateAppointmentInput } from './types';

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly';
interface TokenResponse { access_token?: string; expires_in?: number; error?: string; scope?: string }
interface GoogleIdentity {
  accounts: { oauth2: {
    initTokenClient(config: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback: () => void }): { requestAccessToken(options: { prompt: string }): void };
    revoke(token: string, callback: (result: { successful?: boolean }) => void): void;
  } };
}
declare global { interface Window { google?: GoogleIdentity } }
let identityLoading: Promise<void> | undefined;
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (identityLoading) return identityLoading;
  identityLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 15_000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      identityLoading = undefined;
      reject(new Error('Não foi possível carregar o Google. Verifique a conexão e tente novamente.'));
    }
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.google?.accounts.oauth2) resolve(); else fail();
    };
    document.head.append(script);
  });
  return identityLoading;
}
export interface GoogleCalendar { id: string; summary: string; primary?: boolean }
interface GoogleEvent {
  id?: string; status?: string; summary?: string; location?: string; recurringEventId?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
}
export type GoogleImportedEvent = CreateAppointmentInput & { importedUid: string; importedCalendarId: string; importedCalendarName: string };
export interface GoogleSnapshot { events: GoogleImportedEvent[]; calendarIds: string[]; from: string; to: string }
function localDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('O Google retornou uma data inválida.');
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) throw new Error('O Google retornou uma data inválida.');
  return date.toISOString();
}
export function normalizeGoogleEvent(event: GoogleEvent, calendar: GoogleCalendar): GoogleImportedEvent | null {
  if (event.status === 'cancelled') return null;
  const startsAt = event.start?.dateTime ?? (event.start?.date ? localDay(event.start.date) : '');
  const endsAt = event.end?.dateTime ?? (event.end?.date ? localDay(event.end.date) : '');
  if (!event.id || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('O Google retornou eventos incompletos. A sincronização foi interrompida.');
  }
  const title = (event.summary?.trim() || 'Sem título').slice(0, 120);
  return {
    importedUid: `google:${encodeURIComponent(calendar.id)}:${encodeURIComponent(event.id)}`,
    importedCalendarId: `google:${calendar.id}`, importedCalendarName: calendar.summary,
    title, type: classifyImportedAppointment(title), startsAt, endsAt,
    isAllDay: Boolean(event.start?.date), isRecurring: Boolean(event.recurringEventId),
    ...(event.location ? { location: event.location } : {}),
  };
}

export function createGoogleCalendarClient(fetcher: typeof fetch = fetch) {
  let token: string | undefined;
  let expiresAt = 0;
  let generation = 0;
  function clear() { token = undefined; expiresAt = 0; generation += 1; }
  function connected() { return Boolean(token && Date.now() < expiresAt); }
  async function page<T>(path: string, params: URLSearchParams): Promise<T> {
    if (!connected()) { clear(); throw new Error('A sessão do Google expirou. Conecte novamente.'); }
    const response = await fetcher(`https://www.googleapis.com/calendar/v3/${path}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401) { clear(); throw new Error('A sessão do Google expirou. Conecte novamente.'); }
    if (!response.ok) throw new Error(response.status === 403
      ? 'O Google recusou a leitura. Verifique as permissões e se a Calendar API está habilitada.'
      : response.status === 429 ? 'O Google limitou as consultas. Aguarde e tente novamente.' : 'Não foi possível ler o Google Agenda. Tente novamente.');
    return response.json() as Promise<T>;
  }
  async function pages<T>(path: string, params: URLSearchParams): Promise<T[]> {
    const result: T[] = [];
    const seen = new Set<string>();
    do {
      const data = await page<{ items?: T[]; nextPageToken?: string }>(path, params);
      if (data.items !== undefined && !Array.isArray(data.items)) throw new Error('Resposta inválida do Google.');
      result.push(...(data.items ?? []));
      if (!data.nextPageToken) return result;
      if (seen.has(data.nextPageToken)) throw new Error('A leitura do Google ficou incompleta. Tente novamente.');
      seen.add(data.nextPageToken);
      params.set('pageToken', data.nextPageToken);
    } while (true);
  }
  return {
    connected,
    async connect(clientId: string) {
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId.trim())) throw new Error('Configure um Client ID OAuth válido do Google.');
      await loadGoogleIdentity();
      clear();
      const current = ++generation;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { generation += 1; reject(new Error('A conexão com o Google expirou. Tente novamente.')); }, 120_000);
        const finish = (error?: string) => {
          window.clearTimeout(timeout);
          if (error) { if (current === generation) generation += 1; reject(new Error(error)); } else resolve();
        };
        window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId.trim(), scope: GOOGLE_SCOPES,
          callback: (response) => {
            if (current !== generation) { finish('Conexão cancelada. Tente novamente.'); return; }
            const granted = new Set(response.scope?.split(' ') ?? []);
            if (response.error || !response.access_token || !GOOGLE_SCOPES.split(' ').every(scope => granted.has(scope))) {
              finish('Autorize a leitura dos calendários e eventos para conectar.'); return;
            }
            token = response.access_token;
            expiresAt = Date.now() + Math.max(0, (response.expires_in ?? 3600) - 60) * 1000;
            finish();
          },
          error_callback: () => finish('A janela do Google foi fechada ou bloqueada. Permita pop-ups e tente novamente.'),
        }).requestAccessToken({ prompt: 'select_account' });
      });
    },
    async disconnect() {
      const previous = token;
      clear();
      if (!previous || !window.google) return;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('A sessão local foi encerrada. Revogue também o acesso nas permissões da sua Conta Google.')), 10_000);
        window.google!.accounts.oauth2.revoke(previous, result => {
          window.clearTimeout(timeout);
          if (result.successful) resolve(); else reject(new Error('A sessão local foi encerrada. Revogue também o acesso nas permissões da sua Conta Google.'));
        });
      });
    },
    async calendars(): Promise<GoogleCalendar[]> {
      const calendars = await pages<GoogleCalendar>('users/me/calendarList', new URLSearchParams({
        maxResults: '250', minAccessRole: 'reader', fields: 'items(id,summary,primary),nextPageToken',
      }));
      if (calendars.some(item => !item.id || !item.summary)) throw new Error('Lista de calendários inválida.');
      return calendars;
    },
    async snapshot(calendars: GoogleCalendar[], now = new Date()): Promise<GoogleSnapshot> {
      if (!calendars.length || new Set(calendars.map(item => item.id)).size !== calendars.length) throw new Error('Selecione ao menos um calendário válido.');
      const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(fromDate); end.setDate(end.getDate() + 90);
      const from = fromDate.toISOString(); const to = end.toISOString();
      const events: GoogleImportedEvent[] = [];
      for (const calendar of calendars) {
        const items = await pages<GoogleEvent>(`calendars/${encodeURIComponent(calendar.id)}/events`, new URLSearchParams({
          timeMin: from, timeMax: to, singleEvents: 'true', showDeleted: 'false', maxResults: '2500',
          fields: 'items(id,status,summary,location,start,end,recurringEventId),nextPageToken',
        }));
        for (const item of items) { const event = normalizeGoogleEvent(item, calendar); if (event) events.push(event); }
      }
      return { events, calendarIds: calendars.map(item => `google:${item.id}`), from, to };
    },
  };
}
