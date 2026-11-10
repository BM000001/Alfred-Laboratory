export interface CalendarSyncState {
  id: string;
  provider: 'google';
  calendarId: string;
  syncToken?: string;
  lastSyncedAt?: string;
}

/**
 * A Google write that was confirmed by the user but whose outcome is not yet
 * known locally. The event snapshot is kept only in IndexedDB so retries send
 * exactly the same payload after a timeout or page reload.
 */
export interface PendingGoogleCalendarCreate {
  id: string;
  provider: 'google';
  appointmentId: string;
  accountId: string;
  calendarId: string;
  eventId: string;
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { date?: string; dateTime?: string; timeZone?: string };
    end: { date?: string; dateTime?: string; timeZone?: string };
  };
  createdAt: string;
  status: 'pending' | 'uncertain';
}
