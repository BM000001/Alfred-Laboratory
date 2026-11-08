import { describe, expect, it } from 'vitest';
import { summarizeStudyPerformance } from './studyPerformance';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import type { StudyTopic } from './types';

const topics: StudyTopic[] = [
  { id: 'topic-a', disciplineId: 'math', title: 'Limites', status: 'pending', createdAt: '2026-11-01T00:00:00.000Z' },
  { id: 'topic-b', disciplineId: 'math', title: 'Derivadas', status: 'pending', createdAt: '2026-11-01T00:00:00.000Z' },
];
const questions: StudyQuestion[] = [
  { id: 'q1', disciplineId: 'math', topicId: 'topic-a', prompt: 'Defina limite', options: ['A', 'B'], correctOptionIndex: 1, difficulty: 'easy', createdAt: '2026-11-01T00:00:00.000Z' },
  { id: 'q2', disciplineId: 'math', topicId: 'topic-a', prompt: 'Limite lateral', options: ['C', 'D'], correctOptionIndex: 0, difficulty: 'medium', createdAt: '2026-11-01T00:00:00.000Z' },
  { id: 'q3', disciplineId: 'math', topicId: 'topic-b', prompt: 'Derivada', options: ['E', 'F'], correctOptionIndex: 1, difficulty: 'hard', createdAt: '2026-11-01T00:00:00.000Z' },
];
const attempts: StudyQuizAttempt[] = [
  { id: 'a1', disciplineId: 'math', startedAt: '2026-11-02T00:00:00.000Z', completedAt: '2026-11-02T00:05:00.000Z', totalQuestions: 3, correctAnswers: 1, answers: [
    { questionId: 'q1', selectedOptionIndex: 1, isCorrect: true },
    { questionId: 'q2', selectedOptionIndex: 0, isCorrect: true },
    { questionId: 'q3', selectedOptionIndex: 0, isCorrect: false },
  ] },
  { id: 'a2', disciplineId: 'math', startedAt: '2026-11-03T00:00:00.000Z', completedAt: '2026-11-03T00:05:00.000Z', totalQuestions: 2, correctAnswers: 0, answers: [
    { questionId: 'q1', selectedOptionIndex: 0, isCorrect: false },
    { questionId: 'q3', selectedOptionIndex: 0, isCorrect: false },
  ] },
];

describe('summarizeStudyPerformance', () => {
  it('aggregates accuracy by topic and sorts weakest topics first', () => {
    const result = summarizeStudyPerformance(topics, questions, attempts);
    expect(result[0]).toMatchObject({ topicId: 'topic-b', answered: 2, correct: 0, incorrect: 2, accuracy: 0 });
    expect(result[1]).toMatchObject({ topicId: 'topic-a', answered: 3, correct: 2, incorrect: 1, accuracy: 67 });
    expect(result[1].questions[0]).toMatchObject({ questionId: 'q1', correctAnswer: 'B', incorrect: 1 });
  });

  it('keeps topics without attempts visible as not yet practiced', () => {
    const result = summarizeStudyPerformance(topics, questions.slice(0, 1), []);
    expect(result[0]).toMatchObject({ topicId: 'topic-a', answered: 0, accuracy: 0 });
  });

  it('ignores answers for questions that were deleted', () => {
    const result = summarizeStudyPerformance(topics, [], attempts);
    expect(result).toEqual([]);
  });
});
