import type { Task, TaskFilters } from './types';
import { TASK_TITLE_MAX_LENGTH } from './types';

export function validateTaskTitle(title: string): string | null {
  const normalized = title.trim();
  if (!normalized) return 'O título da tarefa é obrigatório.';
  if (normalized.length > TASK_TITLE_MAX_LENGTH) return `O título deve ter no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`;
  return null;
}

export function filterTasks(tasks: Task[], filters: TaskFilters = {}): Task[] {
  return tasks.filter((task) => {
    if (filters.status && filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    return true;
  });
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status === 'completed' || !task.dueDate) return false;
  return task.dueDate < toLocalDateKey(now);
}
