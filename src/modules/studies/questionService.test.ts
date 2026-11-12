import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import { createQuestionService, gradeStudyAnswer, summarizeQuiz, selectQuizQuestions } from './questionService';

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

describe('questionService', () => {
  it('creates and validates multiple-choice questions', async () => {
    const questions = memoryRepository<StudyQuestion>();
    const service = createQuestionService(questions, memoryRepository<StudyQuizAttempt>(), {
      createId: () => 'question-1',
      now: () => new Date('2026-11-04T12:00:00.000Z'),
    });
    const question = await service.create({
      disciplineId: 'math',
      prompt: '  Quanto é 2 + 2? ',
      options: [' 3 ', ' 4 ', ' 5 ', ' 6 '],
      correctOptionIndex: 1,
      difficulty: 'easy',
    });
    expect(question.prompt).toBe('Quanto é 2 + 2?');
    expect(question.options[1]).toBe('4');
    expect(await service.list()).toEqual([question]);
    await expect(service.create({
      disciplineId: 'math', prompt: 'Questão', options: ['A', ''], correctOptionIndex: 0, difficulty: 'easy',
    })).rejects.toThrow('preencha todas');
  });

  it('updates a question without changing its stable id or creation date and clears removed metadata', async () => {
    const questions = memoryRepository<StudyQuestion>();
    const service = createQuestionService(questions, memoryRepository<StudyQuizAttempt>(), {
      createId: () => 'question-edit', now: () => new Date('2026-11-04T12:00:00.000Z'),
    });
    const created = await service.create({
      disciplineId: 'math', topicId: 'limits', prompt: 'Pergunta antiga', options: ['A', 'B'],
      correctOptionIndex: 1, difficulty: 'easy', sourceFileName: 'aula.pdf',
    });
    const updated = await service.update(created.id, {
      disciplineId: 'math', prompt: 'Pergunta revisada', options: ['C', 'D', 'E'],
      correctOptionIndex: 2, difficulty: 'hard',
    });
    expect(updated).toMatchObject({ id: created.id, createdAt: created.createdAt, prompt: 'Pergunta revisada', correctOptionIndex: 2, difficulty: 'hard' });
    expect(updated.topicId).toBeUndefined();
    expect(updated.sourceFileName).toBeUndefined();
  });

  it('corrects answers and summarizes a quiz', () => {
    const question = { correctOptionIndex: 2 };
    expect(gradeStudyAnswer(question, 2)).toBe(true);
    expect(gradeStudyAnswer(question, 1)).toBe(false);
    expect(gradeStudyAnswer(question, null)).toBe(false);
    expect(summarizeQuiz([
      { questionId: '1', selectedOptionIndex: 2, isCorrect: true },
      { questionId: '2', selectedOptionIndex: 0, isCorrect: false },
    ])).toEqual({ total: 2, correct: 1, incorrect: 1, percentage: 50 });
  });

  it('persists completed quiz attempts locally', async () => {
    const attempts = memoryRepository<StudyQuizAttempt>();
    const service = createQuestionService(memoryRepository<StudyQuestion>(), attempts);
    const attempt: StudyQuizAttempt = {
      id: 'attempt-1', disciplineId: 'math', startedAt: '2026-11-04T12:00:00.000Z',
      completedAt: '2026-11-04T12:05:00.000Z', totalQuestions: 1, correctAnswers: 1,
      answers: [{ questionId: 'question-1', selectedOptionIndex: 0, isCorrect: true }],
    };
    await service.saveAttempt(attempt);
    expect(await service.listAttempts()).toEqual([attempt]);
    await expect(service.saveAttempt({ ...attempt, correctAnswers: 0 })).rejects.toThrow('não confere');
  });

  it('stores immutable question snapshots so completed attempts survive question edits or deletion', async () => {
    const questions = memoryRepository<StudyQuestion>();
    const attempts = memoryRepository<StudyQuizAttempt>();
    const service = createQuestionService(questions, attempts);
    const question = await service.create({
      disciplineId: 'math', topicId: 'limits', prompt: 'O que é limite?', options: ['A', 'B'],
      correctOptionIndex: 1, explanation: 'Trecho fundamentado.', difficulty: 'medium', sourceFileName: 'aula.pdf',
    });
    const snapshot = {
      prompt: question.prompt, options: [...question.options], correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation, difficulty: question.difficulty, topicId: question.topicId,
      sourceFileName: question.sourceFileName,
    };
    const attempt: StudyQuizAttempt = {
      id: 'snapshot-attempt', disciplineId: 'math', startedAt: '2026-11-04T12:00:00.000Z',
      completedAt: '2026-11-04T12:05:00.000Z', totalQuestions: 1, correctAnswers: 1,
      answers: [{ questionId: question.id, selectedOptionIndex: 1, isCorrect: true, questionSnapshot: snapshot }],
    };
    await service.saveAttempt(attempt);
    await service.delete(question.id);
    expect((await service.listAttempts())[0].answers[0].questionSnapshot).toEqual(snapshot);
    await expect(service.saveAttempt({ ...attempt, answers: [{ ...attempt.answers[0], questionSnapshot: { ...snapshot, correctOptionIndex: 9 } }] })).rejects.toThrow('histórico está inválida');
  });
});


describe('selectQuizQuestions', () => {
  const questions: StudyQuestion[] = [
    { id: 'q1', disciplineId: 'math', topicId: 'limits', prompt: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'easy', createdAt: '2026-11-01T00:00:00.000Z' },
    { id: 'q2', disciplineId: 'math', topicId: 'limits', prompt: 'Q2', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'hard', createdAt: '2026-11-01T00:00:00.000Z' },
    { id: 'q3', disciplineId: 'math', topicId: 'derivatives', prompt: 'Q3', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'hard', createdAt: '2026-11-01T00:00:00.000Z' },
  ];

  it('filters by topic and difficulty', () => {
    expect(selectQuizQuestions(questions, { topicId: 'limits', difficulty: 'hard' }).map(item => item.id)).toEqual(['q2']);
  });

  it('shuffles the question order and respects the requested limit', () => {
    const result = selectQuizQuestions(questions, { limit: 2, random: () => 0 });
    expect(result).toHaveLength(2);
    expect(result.map(item => item.id)).not.toEqual(['q1', 'q2']);
  });

  it('returns an empty list when no question matches the filters', () => {
    expect(selectQuizQuestions(questions, { topicId: 'missing' })).toEqual([]);
  });
});
