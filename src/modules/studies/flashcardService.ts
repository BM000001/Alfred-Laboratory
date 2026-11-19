import type { EntityRepository } from '../../storage/repositories';
import { normalizeMaterial } from './materialReliability';
import type { FlashcardRating, StudyFlashcard, CreateFlashcardInput } from './flashcardTypes';

type Options = { createId?: () => string; now?: () => Date };
const DAY = 24 * 60 * 60 * 1000;
const MAX_REVIEW_HISTORY = 200;
const MAX_INTERVAL_DAYS = 365;

export function createFlashcardService(repository: EntityRepository<StudyFlashcard>, options: Options = {}) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  async function rejectDuplicate(disciplineId: string, topicId: string | undefined, front: string, back: string, except?: string) {
    const key = [normalizeMaterial(front), normalizeMaterial(back)];
    const cards = await repository.getAll();
    if (cards.some(card => card.id !== except && card.disciplineId === disciplineId && card.topicId === topicId &&
        normalizeMaterial(card.front) === key[0] && normalizeMaterial(card.back) === key[1])) throw new Error('Este flashcard já existe neste tópico.');
  }
  return {
    list: () => repository.getAll(),
    async create(input: CreateFlashcardInput) {
      const front = input.front.trim();
      const back = input.back.trim();
      if (!input.disciplineId) throw new Error('Selecione uma disciplina.');
      if (!front || !back) throw new Error('Preencha a pergunta e a resposta.');
      if (front.length > 500 || back.length > 2000) throw new Error('A pergunta aceita até 500 caracteres e a resposta até 2.000.');
      await rejectDuplicate(input.disciplineId, input.topicId, front, back);
      const timestamp = now().toISOString();
      const card: StudyFlashcard = { id: createId(), disciplineId: input.disciplineId, front, back, createdAt: timestamp, nextReviewAt: timestamp, intervalDays: 0, reviewCount: 0, ...(input.topicId ? { topicId: input.topicId } : {}), ...(input.sourceFileId ? { sourceFileId: input.sourceFileId } : {}), ...(input.sourceFileName ? { sourceFileName: input.sourceFileName } : {}), ...(input.subject ? { subject: input.subject } : {}) };
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
        hard: Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(previous ? previous * 1.2 : 1))),
        good: Math.min(MAX_INTERVAL_DAYS, previous ? Math.max(3, Math.round(previous * 2)) : 3),
        easy: Math.min(MAX_INTERVAL_DAYS, previous ? Math.max(7, Math.round(previous * 2.5)) : 7),
      };
      const intervalDays = intervals[rating];
      const nextReview = new Date(reviewedAt.getTime() + (rating === 'again' ? 10 * 60 * 1000 : intervalDays * DAY));
      const ratedAt = reviewedAt.toISOString();
      const nextReviewAt = nextReview.toISOString();
      const reviewEvent = { ratedAt, rating, intervalDays, nextReviewAt };
      const updated: StudyFlashcard = {
        ...card,
        lastReviewedAt: ratedAt,
        nextReviewAt,
        intervalDays,
        reviewCount: card.reviewCount + 1,
        reviewHistory: [...(card.reviewHistory ?? []), reviewEvent].slice(-MAX_REVIEW_HISTORY),
      };
      await repository.save(updated);
      return updated;
    },
    async update(id: string, changes: { front: string; back: string }) {
      const card = await repository.getById(id);
      if (!card) throw new Error('Flashcard não encontrado.');
      const front = changes.front.trim(), back = changes.back.trim();
      if (!front || !back) throw new Error('Preencha a pergunta e a resposta.');
      if (front.length > 500 || back.length > 2000) throw new Error('A pergunta aceita até 500 caracteres e a resposta até 2.000.');
      if (front !== card.front || back !== card.back) await rejectDuplicate(card.disciplineId, card.topicId, front, back, id);
      const updated = { ...card, front, back };
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
