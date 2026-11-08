import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { StudyFlashcard } from './flashcardTypes';
import { createFlashcardService, isFlashcardDue } from './flashcardService';

function memoryRepository<T extends { id: string }>(): EntityRepository<T> {
  const items = new Map<string, T>();
  return { async getAll() { return [...items.values()]; }, async getById(id) { return items.get(id); }, async save(item) { items.set(item.id, item); }, async delete(id) { items.delete(id); }, async clear() { items.clear(); } };
}

describe('flashcardService', () => {
  it('creates cards locally and validates both sides', async () => {
    const repository = memoryRepository<StudyFlashcard>();
    const service = createFlashcardService(repository, { createId: () => 'card-1', now: () => new Date('2026-11-04T12:00:00.000Z') });
    const card = await service.create({ disciplineId: 'math', front: '  O que é limite? ', back: ' Valor ao qual a função se aproxima. ' });
    expect(card.front).toBe('O que é limite?');
    expect(card.back).toBe('Valor ao qual a função se aproxima.');
    await expect(service.create({ disciplineId: 'math', front: ' ', back: 'Resposta' })).rejects.toThrow('pergunta e a resposta');
  });

  it('schedules review intervals according to the learner rating', async () => {
    const repository = memoryRepository<StudyFlashcard>();
    const service = createFlashcardService(repository, { createId: () => 'card-1', now: () => new Date('2026-11-04T12:00:00.000Z') });
    const card = await service.create({ disciplineId: 'math', front: 'Pergunta', back: 'Resposta' });
    const afterGood = await service.review(card.id, 'good');
    expect(afterGood.intervalDays).toBe(3);
    expect(afterGood.nextReviewAt).toBe('2026-11-07T12:00:00.000Z');
    const afterAgain = await service.review(card.id, 'again');
    expect(afterAgain.intervalDays).toBe(0);
    expect(afterAgain.nextReviewAt).toBe('2026-11-04T12:10:00.000Z');
    expect(afterAgain.reviewCount).toBe(2);
  });

  it('identifies cards that are due', () => {
    const card: StudyFlashcard = { id: '1', disciplineId: 'math', front: 'Q', back: 'A', createdAt: '', nextReviewAt: '2026-11-04T10:00:00.000Z', intervalDays: 0, reviewCount: 0 };
    expect(isFlashcardDue(card, new Date('2026-11-04T12:00:00.000Z'))).toBe(true);
    expect(isFlashcardDue(card, new Date('2026-11-04T09:00:00.000Z'))).toBe(false);
  });
});
