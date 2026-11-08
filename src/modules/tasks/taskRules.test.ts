import { describe, expect, it } from 'vitest';
import { filterTasks, isTaskOverdue, validateTaskTitle } from './taskRules';
import type { Task } from './types';

const tasks: Task[] = [
  { id: 'task-1', title: 'Estudar TypeScript', status: 'pending', priority: 'high', createdAt: '2026-11-01T10:00:00.000Z', dueDate: '2026-11-03', projectId: 'project-1' },
  { id: 'task-2', title: 'Revisar anotações', status: 'completed', priority: 'low', createdAt: '2026-11-01T11:00:00.000Z', projectId: 'project-1' },
  { id: 'task-3', title: 'Enviar relatório', status: 'pending', priority: 'medium', createdAt: '2026-11-01T12:00:00.000Z', dueDate: '2026-11-01', projectId: 'project-2' },
];

describe('validateTaskTitle', () => {
  it('rejects empty or whitespace-only titles', () => {
    expect(validateTaskTitle('')).toBe('O título da tarefa é obrigatório.');
    expect(validateTaskTitle('   ')).toBe('O título da tarefa é obrigatório.');
  });
  it('accepts a valid title with surrounding whitespace', () => {
    expect(validateTaskTitle('  Estudar  ')).toBeNull();
  });
  it('rejects titles longer than the maximum', () => {
    expect(validateTaskTitle('a'.repeat(121))).toContain('120 caracteres');
  });
});

describe('filterTasks', () => {
  it('filters by status, priority and project', () => {
    expect(filterTasks(tasks, { status: 'pending' })).toHaveLength(2);
    expect(filterTasks(tasks, { priority: 'high' }).map((task) => task.id)).toEqual(['task-1']);
    expect(filterTasks(tasks, { projectId: 'project-1' })).toHaveLength(2);
    expect(filterTasks(tasks, { status: 'pending', projectId: 'project-2' }).map((task) => task.id)).toEqual(['task-3']);
  });
  it('returns all tasks when no filters are provided', () => {
    expect(filterTasks(tasks)).toEqual(tasks);
    expect(filterTasks(tasks, { status: 'all' })).toEqual(tasks);
  });
});

describe('isTaskOverdue', () => {
  const today = new Date(2026, 10, 2, 12, 0, 0);
  it('marks a pending task with a past due date as overdue', () => {
    expect(isTaskOverdue(tasks[2], today)).toBe(true);
  });
  it('does not mark a task due today or in the future as overdue', () => {
    expect(isTaskOverdue(tasks[0], today)).toBe(false);
  });
  it('does not mark completed tasks as overdue', () => {
    expect(isTaskOverdue({ ...tasks[2], status: 'completed' }, today)).toBe(false);
  });
  it('does not mark tasks without a due date as overdue', () => {
    expect(isTaskOverdue(tasks[1], today)).toBe(false);
  });
});
