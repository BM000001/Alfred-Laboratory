import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { Task } from './types';
import { createTaskService } from './taskService';

function createMemoryRepository<T extends { id: string }>(): EntityRepository<T> {
  const records = new Map<string, T>();
  return {
    async getAll() { return [...records.values()]; },
    async getById(id) { return records.get(id); },
    async save(entity) { records.set(entity.id, entity); },
    async delete(id) { records.delete(id); },
    async clear() { records.clear(); },
  };
}

describe('taskService', () => {
  it('creates a task with normalized title and defaults', async () => {
    const service = createTaskService(createMemoryRepository<Task>(), {
      createId: () => 'task-1',
      now: () => new Date('2026-11-02T12:00:00.000Z'),
    });

    const task = await service.create({ title: '  Estudar TypeScript  ', priority: 'high' });

    expect(task).toMatchObject({
      id: 'task-1',
      title: 'Estudar TypeScript',
      status: 'pending',
      priority: 'high',
      createdAt: '2026-11-02T12:00:00.000Z',
    });
  });

  it('rejects an empty title', async () => {
    const service = createTaskService(createMemoryRepository<Task>());
    await expect(service.create({ title: '   ', priority: 'medium' }))
      .rejects.toThrow('O título da tarefa é obrigatório.');
  });

  it('updates and completes an existing task', async () => {
    const repository = createMemoryRepository<Task>();
    const service = createTaskService(repository, { createId: () => 'task-2' });
    const created = await service.create({ title: 'Ler documentação', priority: 'medium' });

    const updated = await service.update(created.id, { title: 'Ler TypeScript' });
    const completed = await service.complete(created.id);

    expect(updated.title).toBe('Ler TypeScript');
    expect(completed.status).toBe('completed');
  });

  it('allows status updates and removes an optional description when cleared', async () => {
    const service = createTaskService(createMemoryRepository<Task>(), { createId: () => 'task-description' });
    const created = await service.create({
      title: 'Revisar matéria',
      priority: 'medium',
      description: 'Descrição inicial',
    });

    const withoutDescription = await service.update(created.id, { description: '   ' });
    const completed = await service.update(created.id, { status: 'completed' });

    expect(withoutDescription.description).toBeUndefined();
    expect(Object.hasOwn(withoutDescription, 'description')).toBe(false);
    expect(completed.status).toBe('completed');
  });

  it('rejects update when task does not exist', async () => {
    const service = createTaskService(createMemoryRepository<Task>());
    await expect(service.update('missing', { title: 'Novo título' }))
      .rejects.toThrow('Tarefa não encontrada.');
  });

  it('deletes an existing task', async () => {
    const repository = createMemoryRepository<Task>();
    const service = createTaskService(repository, { createId: () => 'task-3' });
    await service.create({ title: 'Excluir depois', priority: 'low' });

    await service.delete('task-3');

    expect(await service.get('task-3')).toBeUndefined();
  });
});
