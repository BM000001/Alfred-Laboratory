/**
 * Google Apps Script RPC bridge. The Apps Script window is opened by an
 * explicit user gesture and runs as the accessing Google account. OAuth
 * tokens never enter this browser module or persistent browser storage.
 */
export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  htmlLink?: string;
  recurringEventId?: string;
}

type RpcRequest = { method: string; params?: Record<string, unknown> };
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: number;
};

const APP_SCRIPT_URL = (import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ?? "").trim();
const CHANNEL = "alfred-google-calendar";
let popup: Window | null = null;
let popupOrigin = "";
let bridgeWindow: Window | null = null;
let bridgeNonce = "";
let bridgeReady = false;
let requestSequence = 0;
let readyTimer = 0;
let readyResolve: (() => void) | null = null;
let readyReject: ((error: Error) => void) | null = null;
const pending = new Map<string, PendingRequest>();

export function isGoogleCalendarConfigured(): boolean {
  if (!APP_SCRIPT_URL) return false;
  try {
    const url = new URL(APP_SCRIPT_URL);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && url.pathname.includes('/macros/s/') && url.pathname.endsWith('/exec');
  } catch {
    return false;
  }
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function isTrustedAppsScriptOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      (url.hostname === "script.google.com" || url.hostname === "script.googleusercontent.com" ||
        /^n-[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname));
  } catch {
    return false;
  }
}

function rejectPending(message: string): void {
  for (const [id, item] of pending) {
    window.clearTimeout(item.timeout);
    item.reject(new Error(message));
    pending.delete(id);
  }
}

function isPopupFrame(source: MessageEventSource | null): source is Window {
  if (!popup || !source) return false;
  if (source === popup) return true;
  try {
    for (let index = 0; index < popup.length; index += 1) {
      if (popup.frames[index] === source) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function handleBridgeMessage(event: MessageEvent): void {
  if (!popup || !isPopupFrame(event.source) || !isTrustedAppsScriptOrigin(event.origin)) return;
  const data = event.data as Record<string, unknown> | null;
  if (!data || data.channel !== CHANNEL || data.nonce !== bridgeNonce) return;

  if (data.type === "ready") {
    popupOrigin = event.origin;
    bridgeWindow = event.source as Window;
    bridgeReady = true;
    window.clearTimeout(readyTimer);
    readyResolve?.();
    readyResolve = null;
    readyReject = null;
    return;
  }

  if (event.source !== bridgeWindow || data.type !== "rpc-result" || typeof data.requestId !== "string") return;
  const item = pending.get(data.requestId);
  if (!item) return;
  window.clearTimeout(item.timeout);
  pending.delete(data.requestId);
  if (data.ok === true) item.resolve(data.result);
  else item.reject(new Error(typeof data.error === "string" ? data.error : "Falha na integração Google."));
}

function ensureBridge(): void {
  if (!APP_SCRIPT_URL) {
    throw new Error("A integração Google ainda não foi configurada. Falta definir VITE_GOOGLE_APPS_SCRIPT_URL.");
  }
  if (!isGoogleCalendarConfigured()) {
    throw new Error("A URL do Google Apps Script não é válida. Use a URL HTTPS de implantação /exec.");
  }
}

export function beginGoogleCalendarConnection(): Promise<void> {
  ensureBridge();
  if (popup && !popup.closed && bridgeReady) return Promise.resolve();

  window.clearTimeout(readyTimer);
  readyReject?.(new Error("A tentativa anterior de conexão foi substituída."));
  readyResolve = null;
  readyReject = null;
  if (popup && !popup.closed) popup.close();
  popup = null;
  popupOrigin = "";
  bridgeWindow = null;
  bridgeReady = false;
  bridgeNonce = createNonce();

  const url = new URL(APP_SCRIPT_URL);
  url.searchParams.set("nonce", bridgeNonce);
  window.addEventListener("message", handleBridgeMessage);

  // This call occurs synchronously inside the user's Connect-button gesture.
  // iOS Safari may present the popup as a new tab; the bridge requires opener
  // messaging to remain available, which is explicitly covered by manual tests.
  popup = window.open(url.toString(), "alfredGoogleCalendar", "popup=yes,width=520,height=720");
  if (!popup) {
    window.removeEventListener("message", handleBridgeMessage);
    throw new Error("O Safari bloqueou a janela do Google. Permita a abertura de pop-ups para o Alfred e tente novamente.");
  }

  return new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
    readyTimer = window.setTimeout(() => {
      readyResolve = null;
      readyReject = null;
      window.removeEventListener("message", handleBridgeMessage);
      if (popup && !popup.closed) popup.close();
      popup = null;
      popupOrigin = "";
      bridgeWindow = null;
      bridgeReady = false;
      bridgeNonce = "";
      reject(new Error("O Google Apps Script não estabeleceu comunicação com o Alfred. Verifique a autorização e se a janela continua aberta."));
    }, 90_000);
  });
}

export async function completeGoogleCalendarConnection(): Promise<boolean> {
  // No OAuth callback or credential is persisted in the Alfred page.
  return false;
}

export function isGoogleCalendarSessionActive(): boolean {
  if (popup && popup.closed) {
    window.clearTimeout(readyTimer);
    readyResolve = null;
    readyReject?.(new Error("A janela de conexão do Google foi encerrada."));
    readyReject = null;
    popup = null;
    popupOrigin = "";
    bridgeWindow = null;
    bridgeReady = false;
    bridgeNonce = "";
    window.removeEventListener("message", handleBridgeMessage);
    rejectPending("A janela de conexão do Google foi encerrada.");
    return false;
  }
  return Boolean(popup && !popup.closed && bridgeWindow && bridgeReady);
}

export function clearGoogleCalendarSession(): void {
  window.clearTimeout(readyTimer);
  readyResolve = null;
  readyReject?.(new Error("A conexão com o Google foi encerrada."));
  readyReject = null;
  if (popup && !popup.closed) popup.close();
  popup = null;
  popupOrigin = "";
  bridgeWindow = null;
  bridgeReady = false;
  bridgeNonce = "";
  window.removeEventListener("message", handleBridgeMessage);
  rejectPending("A conexão com o Google foi encerrada.");
}

async function request<T>(request: RpcRequest): Promise<T> {
  if (!isGoogleCalendarSessionActive() || !bridgeWindow || !popupOrigin) {
    throw new Error("A janela de conexão do Google não está ativa. Conecte novamente.");
  }
  const requestId = String(++requestSequence);
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("O Google Apps Script demorou demais para responder. Tente novamente."));
    }, 60_000);
    pending.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
      timeout,
    });
    try {
      bridgeWindow!.postMessage({
        channel: CHANNEL,
        type: "rpc",
        nonce: bridgeNonce,
        requestId,
        request,
      }, popupOrigin);
    } catch {
      window.clearTimeout(timeout);
      pending.delete(requestId);
      reject(new Error("Não foi possível enviar a solicitação à janela Google."));
    }
  });
}

export async function getGoogleCalendarSession(): Promise<{ connected: boolean; accountId: string; email?: string }> {
  return request({ method: "session" });
}

export async function listGoogleCalendars(): Promise<GoogleCalendarInfo[]> {
  const calendars: GoogleCalendarInfo[] = [];
  let pageToken: string | undefined;
  do {
    const page = await request<{ items?: GoogleCalendarInfo[]; nextPageToken?: string }>({
      method: "calendars",
      params: pageToken ? { pageToken } : {},
    });
    calendars.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return calendars;
}

export async function listGoogleEvents(
  calendarId: string,
  options: { syncToken?: string; timeMin?: string; timeMax?: string; pageToken?: string; singleEvents?: boolean } = {},
): Promise<{ items?: GoogleCalendarEvent[]; nextPageToken?: string; nextSyncToken?: string }> {
  return request({
    method: "events",
    params: { calendarId, ...options },
  });
}

export function createGoogleEvent(
  calendarId: string,
  eventId: string,
  operationId: string,
  event: Omit<GoogleCalendarEvent, "id" | "etag" | "status" | "updated" | "htmlLink">,
): Promise<GoogleCalendarEvent> {
  return request({ method: "createEvent", params: { calendarId, eventId, operationId, event } });
}

function requireVersionEtag(etag?: string): string {
  if (!etag || !etag.trim() || etag.trim() === "*" || /[\u0000-\u001f\u007f]/.test(etag)) {
    throw new Error("Este evento não tem uma versão Google verificável. Sincronize novamente antes de alterar ou excluir.");
  }
  return etag.trim();
}

export function updateGoogleEvent(
  calendarId: string,
  eventId: string,
  event: Omit<GoogleCalendarEvent, "id" | "etag" | "status" | "updated" | "htmlLink">,
  etag?: string,
): Promise<GoogleCalendarEvent> {
  return request({ method: "updateEvent", params: { calendarId, eventId, event, etag: requireVersionEtag(etag) } });
}

export function deleteGoogleEvent(calendarId: string, eventId: string, etag?: string): Promise<void> {
  return request({ method: "deleteEvent", params: { calendarId, eventId, etag: requireVersionEtag(etag) } }).then(() => undefined);
}

export async function disconnectGoogleCalendar(): Promise<{ googleRevocation: "confirmed" | "not_confirmed" }> {
  // Local disconnection must work even if the Google authorization has already
  // expired or been revoked. The OAuth grant itself is revoked in Google Account.
  clearGoogleCalendarSession();
  return { googleRevocation: "not_confirmed" };
}
