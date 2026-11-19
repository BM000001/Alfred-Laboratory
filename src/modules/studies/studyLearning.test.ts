import { describe, expect, it } from 'vitest';
import { buildStudyLearningUnits, createLearningProgress } from './studyLearning';
import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import type { StudyTopic } from './types';

const topics: StudyTopic[] = [
  { id: 'topic-a', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' },
  { id: 'topic-b', disciplineId: 'software', title: 'Testes', status: 'pending', createdAt: '' },
];

const cards: StudyFlashcard[] = [
  { id: 'card-encap', disciplineId: 'software', topicId: 'topic-a', subject: 'Encapsulamento', front: 'O que o material define como “Encapsulamento”?', back: 'Técnica que protege componentes internos.', createdAt: '', nextReviewAt: '2026-11-01T00:00:00.000Z', intervalDays: 1, reviewCount: 1 },
  { id: 'card-tests', disciplineId: 'software', topicId: 'topic-b', subject: 'Testes', front: 'O que o material define como “Testes”?', back: 'Prática que verifica o comportamento esperado.', createdAt: '', nextReviewAt: '2099-11-01T00:00:00.000Z', intervalDays: 7, reviewCount: 1 },
];

const questions: StudyQuestion[] = [
  { id: 'question-encap', disciplineId: 'software', topicId: 'topic-a', subject: 'Encapsulamento', prompt: 'Qual conceito protege componentes?', options: ['Herança', 'Encapsulamento'], correctOptionIndex: 1, explanation: 'Trecho de origem: Técnica que protege componentes internos.', difficulty: 'easy', createdAt: '' },
];

describe('studyLearning', () => {
  it('pairs an existing concept with a matching analogy only', () => {
    const units = buildStudyLearningUnits({ cards, questions, attempts: [], topics, progress: [], context: 'football', now: new Date('2026-11-12T00:00:00.000Z') });
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ concept: 'Encapsulamento', formalExplanation: 'Técnica que protege componentes internos.', reviewReason: 'due-review' });
    expect(units[0].analogy).toContain('vestiário');
    expect(units[0].sourceExcerpt).toBeUndefined();
  });

  it('teaches shared references with a new trace and keeps unsupported cards extractive', () => {
    const excerpt = 'Referências em Python: duas variáveis apontam para o mesmo objeto e ambas observam a alteração do atributo compartilhado.';
    const [supported, unsupported] = buildStudyLearningUnits({
      cards: [
        { ...cards[0], subject: 'Referências em Python', sourceExcerpt: excerpt },
        { ...cards[0], id: 'old', subject: 'p2 continua igual', back: 'O valor exibido nesta etapa continua igual.', sourceExcerpt: 'p2 continua igual.' },
      ], questions: [], attempts: [], topics, progress: [], context: 'technical',
      now: new Date('2026-11-12T00:00:00.000Z'),
    }).sort((a, b) => a.id.localeCompare(b.id));
    expect(supported.didactic?.example).toContain('p2 = p1');
    expect(supported.didactic?.answer).toContain('27');
    expect(supported.sourceExcerpt).toBe(excerpt);
    expect(unsupported).toMatchObject({ didactic: undefined, needsReview: true });
  });

  it('prioritizes a topic with at least half incorrect answers', () => {
    const attempts: StudyQuizAttempt[] = [{
      id: 'attempt-1', disciplineId: 'software', startedAt: '', completedAt: '', totalQuestions: 2, correctAnswers: 0,
      answers: [
        { questionId: 'question-encap', selectedOptionIndex: 0, isCorrect: false },
        { questionId: 'question-encap', selectedOptionIndex: 0, isCorrect: false },
      ],
    }];
    const units = buildStudyLearningUnits({ cards, questions, attempts, topics, progress: [], context: 'technical' });
    expect(units[0]).toMatchObject({ concept: 'Encapsulamento', reviewReason: 'weak-topic' });
  });

  it('persists completion independently from the selected analogy context', () => {
    const progress = [createLearningProgress('software', 'lesson:card-tests', 'games', new Date('2026-11-12T12:00:00.000Z'))];
    const units = buildStudyLearningUnits({ cards, questions: [], attempts: [], topics, progress, context: 'series' });
    expect(units.find((unit) => unit.id === 'lesson:card-tests')).toMatchObject({ completed: true, analogy: undefined });
  });
});
