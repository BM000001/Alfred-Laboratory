import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { Discipline, StudyTopic } from './types';
import { createStudyService } from './studyService';
import { summarizeStudyProgress, validateDisciplineName, validateStudyTopic } from './studyRules';

function memoryRepository<T extends { id: string }>(): EntityRepository<T> {
  const items = new Map<string, T>();
  return {
    async getAll() { return [...items.values()]; },
    async getById(id) { return items.get(id); },
    async save(item) { items.set(item.id, item); },
    async delete(id) { items.delete(id); },
    async clear() { items.clear(); },
  };
}

describe('studyRules', () => {
  it('validates discipline and topic names', () => {
    expect(validateDisciplineName('  ')).toBeTruthy();
    expect(validateDisciplineName('Matemática')).toBeNull();
    expect(validateStudyTopic({ disciplineId: 'missing', title: 'Funções' }, [])).toContain('disciplina');
  });

  it('summarizes completed topics', () => {
    const topics = [
      { id: '1', disciplineId: 'd1', title: 'A', status: 'completed', createdAt: '' },
      { id: '2', disciplineId: 'd1', title: 'B', status: 'pending', createdAt: '' },
    ] satisfies StudyTopic[];
    expect(summarizeStudyProgress(topics)).toEqual({ total: 2, completed: 1, pending: 1, percentage: 50 });
  });
});

describe('studyService', () => {
  it('creates disciplines and topics and updates topic status', async () => {
    const disciplineRepo = memoryRepository<Discipline>();
    const topicRepo = memoryRepository<StudyTopic>();
    let id = 0;
    const service = createStudyService(disciplineRepo, topicRepo, { createId: () => String(++id), now: () => new Date('2026-11-02T12:00:00.000Z') });
    const discipline = await service.createDiscipline({ name: 'Estrutura de Dados' });
    const topic = await service.createTopic({ disciplineId: discipline.id, title: 'Listas encadeadas' });
    expect(topic.status).toBe('pending');
    await service.updateTopic(topic.id, { status: 'completed' });
    expect((await service.listTopics())[0].status).toBe('completed');
  });

  it('deletes a discipline and its linked topics', async () => {
    const disciplineRepo = memoryRepository<Discipline>();
    const topicRepo = memoryRepository<StudyTopic>();
    const service = createStudyService(disciplineRepo, topicRepo, { createId: (() => { let id = 0; return () => String(++id); })() });
    const discipline = await service.createDiscipline({ name: 'Programação' });
    await service.createTopic({ disciplineId: discipline.id, title: 'Variáveis' });
    await service.deleteDiscipline(discipline.id);
    expect(await service.listDisciplines()).toHaveLength(0);
    expect(await service.listTopics()).toHaveLength(0);
  });

  it('rejects topics linked to unknown disciplines', async () => {
    const service = createStudyService(memoryRepository<Discipline>(), memoryRepository<StudyTopic>());
    await expect(service.createTopic({ disciplineId: 'missing', title: 'Tópico' })).rejects.toThrow('disciplina');
  });
});
