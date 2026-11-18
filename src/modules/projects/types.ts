export type ProjectStatus = 'active' | 'archived';

export type ProjectStage = { id: string; title: string; completed: boolean };

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  stages?: ProjectStage[];
}

export const PROJECT_NAME_MAX_LENGTH = 80;
