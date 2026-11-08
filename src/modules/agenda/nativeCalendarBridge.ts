export interface NativeCalendarEvent {
  id: string;
  externalId?: string | null;
  occurrenceDate?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  isRecurring: boolean;
  calendarTitle: string;
  calendarId: string;
  location: string | null;
}

export interface NativeCalendarInfo {
  id: string;
  title: string;
  source: string;
}

export interface NativeCalendarResponse {
  requestId: string;
  status: 'connected' | 'success' | 'error';
  events?: NativeCalendarEvent[];
  calendars?: NativeCalendarInfo[];
  snapshotComplete?: boolean;
  rangeStart?: string;
  rangeEnd?: string;
  calendarIds?: string[];
  message?: string;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        alfredCalendar?: {
          postMessage: (message: { action: 'connect' | 'sync'; requestId: string; calendarIds?: string[] }) => void;
        };
      };
    };
  }
}

const RESPONSE_EVENT = 'alfred-native-calendar';
const REQUEST_TIMEOUT_MS = 30_000;

export function isNativeAppleCalendarAvailable(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.webkit?.messageHandlers?.alfredCalendar?.postMessage === 'function';
}

function requestNativeCalendar(action: 'connect' | 'sync', calendarIds?: string[]): Promise<NativeCalendarResponse> {
  if (action === 'sync' && (!calendarIds || calendarIds.length === 0 || new Set(calendarIds).size !== calendarIds.length || calendarIds.some((id) => !id.trim()))) {
    return Promise.reject(new Error('Selecione ao menos um calendário válido antes de sincronizar.'));
  }
  if (!isNativeAppleCalendarAvailable()) {
    return Promise.reject(new Error('A conexão direta com o Calendário Apple está disponível no aplicativo iOS do Alfred.'));
  }

  return new Promise((resolve, reject) => {
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `alfred-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const cleanup = () => {
      window.removeEventListener(RESPONSE_EVENT, onResponse);
      window.clearTimeout(timeout);
    };

    const onResponse = (event: Event) => {
      const response = (event as CustomEvent<NativeCalendarResponse>).detail;
      if (!response || response.requestId !== requestId) return;
      cleanup();
      if (response.status === 'error') {
        reject(new Error(response.message || 'Não foi possível sincronizar o calendário.'));
      } else {
        resolve(response);
      }
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('O Calendário Apple não respondeu. Tente novamente.'));
    }, REQUEST_TIMEOUT_MS);

    window.addEventListener(RESPONSE_EVENT, onResponse);

    try {
      window.webkit!.messageHandlers!.alfredCalendar!.postMessage({ action, requestId, ...(calendarIds ? { calendarIds } : {}) });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Falha ao solicitar acesso ao Calendário Apple.'));
    }
  });
}

export function connectAppleCalendar(): Promise<NativeCalendarResponse> {
  return requestNativeCalendar('connect');
}

export function syncAppleCalendar(calendarIds: string[]): Promise<NativeCalendarResponse> {
  return requestNativeCalendar('sync', calendarIds);
}
