import type { EntityRepository } from '../../storage/repositories';
import type { FlashcardRating, StudyFlashcard, CreateFlashcardInput } from './flashcardTypes';

type Options = { createId?: () => string; now?: () => Date };
const DAY = 24 * 60 * 60 * 1000;

export function createFlashcardService(repository: EntityRepository<StudyFlashcard>, options: Options = {}) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  return {
    list: () => repository.getAll(),
    async create(input: CreateFlashcardInput) {
      const front = input.front.trim();
      const back = input.back.trim();
      if (!input.disciplineId) throw new Error('Selecione uma disciplina.');
      if (!front || !back) throw new Error('Preencha a pergunta e a resposta.');
      if (front.length > 500 || back.length > 2000) throw new Error('A pergunta aceita até 500 caracteres e a resposta até 2.000.');
      const timestamp = now().toISOString();
      const card: StudyFlashcard = { id: createId(), disciplineId: input.disciplineId, front, back, createdAt: timestamp, nextReviewAt: timestamp, intervalDays: 0, reviewCount: 0 };
      await repository.save(card);
      return card;
    },
    async review(id: string, rating: FlashcardRating) {
      const card = await repository.getById(id);
      if (!card) throw new Error('Flashcard não encontrado.');
      const reviewedAt = now();
      const previous = card.intervalDays;
      const intervals: Record<FlashcardRating, number> = {
        again: 0,
        hard: Math.max(1, Math.round(previous ? previous * 1.2 : 1)),
        good: previous ? Math.max(3, Math.round(previous * 2)) : 3,
        easy: previous ? Math.max(7, Math.round(previous * 2.5)) : 7,
      };
      const intervalDays = intervals[rating];
      const nextReview = new Date(reviewedAt.getTime() + (rating === 'again' ? 10 * 60 * 1000 : intervalDays * DAY));
      const updated: StudyFlashcard = { ...card, lastReviewedAt: reviewedAt.toISOString(), nextReviewAt: nextReview.toISOString(), intervalDays, reviewCount: card.reviewCount + 1 };
      await repository.save(updated);
      return updated;
    },
    async delete(id: string) {
      if (!(await repository.getById(id))) throw new Error('Flashcard não encontrado.');
      await repository.delete(id);
    },
  };
}

export function isFlashcardDue(card: StudyFlashcard, at = new Date()): boolean {
  return new Date(card.nextReviewAt).getTime() <= at.getTime();
}
