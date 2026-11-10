export type AppointmentType = 'class' | 'exam' | 'deadline' | 'personal' | 'other';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  location?: string;
  createdAt: string;
  importedUid?: string;
  importedStableUid?: string;
  importedCalendarId?: string;
  importedCalendarName?: string;
  externalProvider?: 'google';
  externalAccountId?: string;
  externalCalendarId?: string;
  externalEventId?: string;
  externalEtag?: string;
}

export type CreateAppointmentInput = Pick<Appointment, 'title' | 'type' | 'startsAt' | 'endsAt'> &
  Partial<Pick<Appointment, 'description' | 'location' | 'isAllDay' | 'isRecurring' | 'importedCalendarName' | 'importedStableUid' | 'externalProvider' | 'externalAccountId' | 'externalCalendarId' | 'externalEventId' | 'externalEtag'>>;

export type UpdateAppointmentInput = Partial<
  Pick<Appointment, 'title' | 'description' | 'type' | 'status' | 'startsAt' | 'endsAt' | 'location' | 'isAllDay' | 'isRecurring' | 'importedCalendarName' | 'importedUid' | 'importedStableUid' | 'importedCalendarId' | 'importedCalendarName' | 'externalProvider' | 'externalAccountId' | 'externalCalendarId' | 'externalEventId' | 'externalEtag'>
>;
