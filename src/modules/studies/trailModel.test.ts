import { expect, it } from 'vitest';
import { minimumTrailCorrect, passesTrailAttempt, unlockedTargetLevel } from './trailModel';
import type { StudyQuizAttempt } from './questionTypes';

const attempt = (trail: StudyQuizAttempt['trail'], totalQuestions: number, correctAnswers: number): StudyQuizAttempt => ({
  id: 'synthetic', disciplineId: 'discipline', startedAt: '', completedAt: '',
  totalQuestions, correctAnswers, answers: Array.from({ length: totalQuestions }, (_, index) => ({
    questionId: String(index), selectedOptionIndex: index < correctAnswers ? 0 : null,
    isCorrect: index < correctAnswers,
  })), trail,
});

it('requires ten questions and only unlocks levels after qualifying attempts', () => {
  const easy = { activity: 'quiz', difficulty: 'easy' } as const;
  expect(passesTrailAttempt(attempt(easy, 9, 9))).toBe(false);
  expect(unlockedTargetLevel('medium', [attempt(easy, 10, 7)])).toBe(false);
  expect(unlockedTargetLevel('medium', [attempt(easy, 10, 8)])).toBe(true);
  expect(unlockedTargetLevel('hard', [attempt(easy, 10, 8)])).toBe(false);
  expect(unlockedTargetLevel('easy', [])).toBe(true);
});

it('requires two of three for verification and rounds the castle minimum up', () => {
  expect(passesTrailAttempt(attempt({ activity: 'verify' }, 3, 2))).toBe(true);
  expect(passesTrailAttempt(attempt({ activity: 'verify' }, 2, 2))).toBe(false);
  expect(minimumTrailCorrect('final', 6)).toBe(5);
  expect(passesTrailAttempt(attempt({ activity: 'final' }, 6, 4))).toBe(false);
  expect(passesTrailAttempt(attempt(undefined, 10, 10))).toBe(false);
});
