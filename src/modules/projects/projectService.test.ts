import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { Project } from './types';
import { createProjectService } from './projectService';

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

describe('projectService', () => {
  it('creates a project with normalized name and active status', async () => {
    const service = createProjectService(createMemoryRepository<Project>(), {
      createId: () => 'project-1',
      now: () => new Date('2026-11-02T12:00:00.000Z'),
    });

    const project = await service.create({ name: '  Alfred  ' });

    expect(project).toMatchObject({
      id: 'project-1',
      name: 'Alfred',
      status: 'active',
      createdAt: '2026-11-02T12:00:00.000Z',
    });
  });

  it('rejects an empty project name', async () => {
    const service = createProjectService(createMemoryRepository<Project>());
    await expect(service.create({ name: '  ' }))
      .rejects.toThrow('O nome do projeto é obrigatório.');
  });

  it('updates and archives an existing project', async () => {
    const service = createProjectService(createMemoryRepository<Project>(), {
      createId: () => 'project-2',
    });
    const created = await service.create({ name: 'Projeto inicial' });

    const updated = await service.update(created.id, { name: 'Projeto revisado' });
    const archived = await service.archive(created.id);

    expect(updated.name).toBe('Projeto revisado');
    expect(archived.status).toBe('archived');
  });

  it('removes an optional description when it is cleared', async () => {
    const service = createProjectService(createMemoryRepository<Project>(), {
      createId: () => 'project-description',
    });
    const created = await service.create({ name: 'Projeto', description: 'Descrição inicial' });

    const updated = await service.update(created.id, { description: '   ' });

    expect(updated.description).toBeUndefined();
    expect(Object.hasOwn(updated, 'description')).toBe(false);
  });

  it('rejects update when project does not exist', async () => {
    const service = createProjectService(createMemoryRepository<Project>());
    await expect(service.update('missing', { name: 'Outro' }))
      .rejects.toThrow('Projeto não encontrado.');
  });

  it('deletes an existing project', async () => {
    const service = createProjectService(createMemoryRepository<Project>(), {
      createId: () => 'project-3',
    });
    await service.create({ name: 'Projeto temporário' });

    await service.delete('project-3');

    expect(await service.get('project-3')).toBeUndefined();
  });
});
