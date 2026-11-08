import type { Project } from './types';
import type { Task } from '../tasks/types';
import { PROJECT_NAME_MAX_LENGTH } from './types';

export interface ProjectTaskSummary {
  total: number;
  pending: number;
  completed: number;
  completionPercentage: number;
}

export function validateProjectName(name: string): string | null {
  const normalized = name.trim();
  if (!normalized) return 'O nome do projeto é obrigatório.';
  if (normalized.length > PROJECT_NAME_MAX_LENGTH) return `O nome do projeto deve ter no máximo ${PROJECT_NAME_MAX_LENGTH} caracteres.`;
  return null;
}

export function summarizeProjectTasks(project: Project, tasks: Task[]): ProjectTaskSummary {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const completed = projectTasks.filter((task) => task.status === 'completed').length;
  const total = projectTasks.length;

  return {
    total,
    pending: total - completed,
    completed,
    completionPercentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
