import { describe, expect, it } from 'vitest';
import { summarizeProjectTasks, validateProjectName } from './projectRules';
import type { Project } from './types';
import type { Task } from '../tasks/types';

const project: Project = { id: 'project-1', name: 'Alfred', status: 'active', createdAt: '2026-11-01T10:00:00.000Z' };
const tasks: Task[] = [
  { id: 'task-1', title: 'Modelar tarefas', status: 'completed', priority: 'high', createdAt: '2026-11-01T10:00:00.000Z', projectId: 'project-1' },
  { id: 'task-2', title: 'Implementar persistência', status: 'pending', priority: 'medium', createdAt: '2026-11-01T11:00:00.000Z', projectId: 'project-1' },
  { id: 'task-3', title: 'Outra tarefa', status: 'pending', priority: 'low', createdAt: '2026-11-01T12:00:00.000Z', projectId: 'project-2' },
];

describe('validateProjectName', () => {
  it('rejects empty or whitespace-only names', () => {
    expect(validateProjectName('')).toBe('O nome do projeto é obrigatório.');
    expect(validateProjectName('   ')).toBe('O nome do projeto é obrigatório.');
  });
  it('accepts a valid name with surrounding whitespace', () => {
    expect(validateProjectName('  Alfred  ')).toBeNull();
  });
  it('rejects names longer than the maximum', () => {
    expect(validateProjectName('a'.repeat(81))).toContain('80 caracteres');
  });
});

describe('summarizeProjectTasks', () => {
  it('counts only tasks associated with the selected project', () => {
    expect(summarizeProjectTasks(project, tasks)).toEqual({ total: 2, pending: 1, completed: 1, completionPercentage: 50 });
  });
  it('returns zero progress when a project has no tasks', () => {
    expect(summarizeProjectTasks(project, [])).toEqual({ total: 0, pending: 0, completed: 0, completionPercentage: 0 });
  });
});
