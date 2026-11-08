export interface FocusSession {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  kind: 'focus';
  taskId?: string;
  taskTitle?: string;
}
