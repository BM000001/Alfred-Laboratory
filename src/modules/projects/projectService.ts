import type { EntityRepository } from '../../storage/repositories';
import type { Project, ProjectStage } from './types';
import { validateProjectName } from './projectRules';

export type CreateProjectInput = Pick<Project, 'name'> &
  Partial<Pick<Project, 'description'>>;

export type UpdateProjectInput = Partial<Pick<Project, 'name' | 'description' | 'status'>>;

export interface ProjectServiceOptions {
  createId?: () => string;
  now?: () => Date;
}

export function createProjectService(
  repository: EntityRepository<Project>,
  options: ProjectServiceOptions = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function update(id: string, changes: UpdateProjectInput): Promise<Project> {
    const current = await repository.getById(id);
    if (!current) throw new Error('Projeto não encontrado.');

    const name = changes.name === undefined ? current.name : changes.name.trim();
    const validationError = validateProjectName(name);
    if (validationError) throw new Error(validationError);

    const updated: Project = { ...current, ...changes, name };
    if (changes.description !== undefined) {
      const description = changes.description.trim();
      if (description) updated.description = description;
      else delete updated.description;
    }

    await repository.save(updated);
    return updated;
  }

  async function changeStages(id: string, change: (current: ProjectStage[]) => ProjectStage[]): Promise<Project> {
    const item = await repository.getById(id);
    if (!item) throw new Error('Projeto não encontrado.');
    const updated = { ...item, stages: change(getProjectStages(item)) };
    await repository.save(updated);
    return updated;
  }

  return {
    async addStage(id: string, input: string): Promise<Project> {
      const title = input.trim();
      if (!title || title.length > 120) throw new Error('Informe um nome de etapa de até 120 caracteres.');
      return changeStages(id, (current) => [...current, { id: createId(), title, completed: false }]);
    },

    async toggleStage(id: string, stageId: string): Promise<Project> {
      return changeStages(id, (current) => current.map((stage) => stage.id === stageId ? { ...stage, completed: !stage.completed } : stage));
    },

    async list(): Promise<Project[]> {
      return repository.getAll();
    },

    async get(id: string): Promise<Project | undefined> {
      return repository.getById(id);
    },

    async create(input: CreateProjectInput): Promise<Project> {
      const name = input.name.trim();
      const validationError = validateProjectName(name);
      if (validationError) throw new Error(validationError);

      const project: Project = {
        id: createId(),
        name,
        status: 'active',
        createdAt: now().toISOString(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      };

      await repository.save(project);
      return project;
    },

    update,

    async archive(id: string): Promise<Project> {
      return update(id, { status: 'archived' });
    },

    async delete(id: string): Promise<void> {
      const current = await repository.getById(id);
      if (!current) throw new Error('Projeto não encontrado.');
      await repository.delete(id);
    },
  };
}

export function getProjectStages(project: Project): ProjectStage[] {
  return Array.isArray(project.stages) ? project.stages.filter((stage) =>
    stage && typeof stage.id === 'string' && typeof stage.title === 'string' && typeof stage.completed === 'boolean') : [];
}
