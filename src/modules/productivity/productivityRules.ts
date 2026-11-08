import type { FocusSession } from './types';

function dateKey(date: Date, timeZone: string): string {
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function summarizeFocusSessions(
  sessions: FocusSession[],
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
) {
  const today = dateKey(now, timeZone);
  const todaySessions = sessions.filter((session) => dateKey(new Date(session.completedAt), timeZone) === today);
  return {
    total: sessions.length,
    today: todaySessions.length,
    todayMinutes: todaySessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    recent: [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 5),
  };
}
