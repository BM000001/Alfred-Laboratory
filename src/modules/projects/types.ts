export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
}

export const PROJECT_NAME_MAX_LENGTH = 80;
