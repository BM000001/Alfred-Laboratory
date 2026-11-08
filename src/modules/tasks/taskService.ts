import type { EntityRepository } from '../../storage/repositories';
import type { Task } from './types';
import { validateTaskTitle } from './taskRules';

export type CreateTaskInput = Pick<Task, 'title' | 'priority'> &
  Partial<Pick<Task, 'description' | 'dueDate' | 'projectId'>>;

export type UpdateTaskInput = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'projectId'>
>;

export interface TaskServiceOptions {
  createId?: () => string;
  now?: () => Date;
}

export function createTaskService(
  repository: EntityRepository<Task>,
  options: TaskServiceOptions = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function update(id: string, changes: UpdateTaskInput): Promise<Task> {
    const current = await repository.getById(id);
    if (!current) throw new Error('Tarefa não encontrada.');

    const title = changes.title === undefined ? current.title : changes.title.trim();
    const validationError = validateTaskTitle(title);
    if (validationError) throw new Error(validationError);

    const updated: Task = { ...current, ...changes, title };
    if (changes.description !== undefined) {
      const description = changes.description.trim();
      if (description) updated.description = description;
      else delete updated.description;
    }

    await repository.save(updated);
    return updated;
  }

  return {
    async list(): Promise<Task[]> {
      return repository.getAll();
    },

    async get(id: string): Promise<Task | undefined> {
      return repository.getById(id);
    },

    async create(input: CreateTaskInput): Promise<Task> {
      const title = input.title.trim();
      const validationError = validateTaskTitle(title);
      if (validationError) throw new Error(validationError);

      const task: Task = {
        id: createId(),
        title,
        status: 'pending',
        priority: input.priority,
        createdAt: now().toISOString(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
      };

      await repository.save(task);
      return task;
    },

    update,

    async complete(id: string): Promise<Task> {
      return update(id, { status: 'completed' });
    },

    async delete(id: string): Promise<void> {
      const current = await repository.getById(id);
      if (!current) throw new Error('Tarefa não encontrada.');
      await repository.delete(id);
    },
  };
}
