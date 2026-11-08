import type { EntityRepository } from '../../storage/repositories';
import type { Discipline, CreateDisciplineInput, UpdateDisciplineInput, StudyTopic, CreateStudyTopicInput, UpdateStudyTopicInput } from './types';
import { validateDisciplineName, validateStudyTopic } from './studyRules';

type Options = { createId?: () => string; now?: () => Date };

export function createStudyService(disciplines: EntityRepository<Discipline>, topics: EntityRepository<StudyTopic>, options: Options = {}) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    listDisciplines: () => disciplines.getAll(),
    listTopics: () => topics.getAll(),
    async createDiscipline(input: CreateDisciplineInput) {
      const error = validateDisciplineName(input.name);
      if (error) throw new Error(error);
      const discipline: Discipline = { id: createId(), name: input.name.trim(), createdAt: now().toISOString(), ...(input.description?.trim() ? { description: input.description.trim() } : {}) };
      await disciplines.save(discipline);
      return discipline;
    },
    async updateDiscipline(id: string, changes: UpdateDisciplineInput) {
      const current = await disciplines.getById(id);
      if (!current) throw new Error('Disciplina não encontrada.');
      if (changes.name !== undefined) {
        const error = validateDisciplineName(changes.name);
        if (error) throw new Error(error);
      }
      const updated = { ...current, ...changes, ...(changes.name !== undefined ? { name: changes.name.trim() } : {}) };
      if (changes.description !== undefined) {
        const description = changes.description.trim();
        if (description) updated.description = description;
        else delete updated.description;
      }
      await disciplines.save(updated);
      return updated;
    },
    async deleteDiscipline(id: string) {
      const current = await disciplines.getById(id);
      if (!current) throw new Error('Disciplina não encontrada.');
      const linked = (await topics.getAll()).filter((topic) => topic.disciplineId === id);
      for (const topic of linked) await topics.delete(topic.id);
      await disciplines.delete(id);
    },
    async createTopic(input: CreateStudyTopicInput) {
      const error = validateStudyTopic(input, await disciplines.getAll());
      if (error) throw new Error(error);
      const topic: StudyTopic = { id: createId(), disciplineId: input.disciplineId, title: input.title.trim(), status: 'pending', createdAt: now().toISOString(), ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}) };
      await topics.save(topic);
      return topic;
    },
    async updateTopic(id: string, changes: UpdateStudyTopicInput) {
      const current = await topics.getById(id);
      if (!current) throw new Error('Conteúdo não encontrado.');
      const updated = { ...current, ...changes, ...(changes.title !== undefined ? { title: changes.title.trim() } : {}) };
      if (changes.title !== undefined && !changes.title.trim()) throw new Error('O título do conteúdo é obrigatório.');
      if (changes.notes !== undefined) {
        const notes = changes.notes.trim();
        if (notes) updated.notes = notes;
        else delete updated.notes;
      }
      await topics.save(updated);
      return updated;
    },
    async deleteTopic(id: string) {
      if (!(await topics.getById(id))) throw new Error('Conteúdo não encontrado.');
      await topics.delete(id);
    },
  };
}
