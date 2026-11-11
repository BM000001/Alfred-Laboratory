import type { Appointment } from './types';
export type CalendarView = 'day' | 'week' | 'month' | 'year';
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function calendarDays(date: Date, view: CalendarView): Date[] {
  const start = new Date(date.getFullYear(), date.getMonth(), view === 'month' ? 1 : date.getDate());
  if (view !== 'day') start.setDate(start.getDate() - start.getDay());
  const length = view === 'day' ? 1 : view === 'week' ? 7 : 42;
  return Array.from({ length }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
export function eventsOnDate(items: Appointment[], date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return items.filter(item => item.status !== 'cancelled' && new Date(item.startsAt) < next && new Date(item.endsAt) > date)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export function CalendarGrid({ date, view, items, onDate, onEvent }: { date: string; view: CalendarView; items: Appointment[]; onDate: (date: string, view: CalendarView) => void; onEvent: (item: Appointment) => void }) {
  const selected = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(selected.getTime())) return <p>Selecione uma data válida.</p>;
  if (view === 'year') return <div className="calendar-year" aria-label={`Calendário de ${selected.getFullYear()}`}>{Array.from({ length: 12 }, (_, month) => {
    const monthDate = new Date(selected.getFullYear(), month, 1);
    return <section className="mini-month" key={month}><button className="text-action" type="button" onClick={() => onDate(localDateKey(monthDate), 'month')}>{monthDate.toLocaleDateString('pt-BR', { month: 'long' })}</button><div className="mini-month-grid">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => <span key={`label-${index}`}>{label}</span>)}{calendarDays(monthDate, 'month').map(day => <button type="button" key={localDateKey(day)} disabled={day.getMonth() !== month} className={eventsOnDate(items, day).length ? 'has-events' : ''} aria-label={day.toLocaleDateString('pt-BR', { dateStyle: 'full' })} onClick={() => onDate(localDateKey(day), 'day')}>{day.getMonth() === month ? day.getDate() : ''}</button>)}</div></section>;
  })}</div>;
  return <div className={`calendar-grid calendar-${view}`} aria-label={`Calendário ${view === 'week' ? 'semanal' : view === 'month' ? 'mensal' : 'diário'}`}>
    {calendarDays(selected, view).map(day => <section key={localDateKey(day)} className={`calendar-cell ${localDateKey(day) === localDateKey(new Date()) ? 'is-today' : ''} ${day.getMonth() !== selected.getMonth() ? 'other-month' : ''}`}>
      <button className="calendar-date" type="button" aria-label={`Ver ${day.toLocaleDateString('pt-BR', { dateStyle: 'full' })}`} onClick={() => onDate(localDateKey(day), 'day')}><small>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</small><strong>{day.getDate()}</strong></button>
      {eventsOnDate(items, day).map(item => <button type="button" className={`calendar-event event-${item.type}`} key={item.id} onClick={() => onEvent(item)}><small>{item.isAllDay ? 'Dia inteiro' : new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small><span>{item.title}</span></button>)}
    </section>)}
  </div>;
}
