import type { StudyQuestionDifficulty, StudyQuizAttempt } from './questionTypes';

/**
 * Alfred Studies 2.2 — modelo da trilha.
 * Camada pura e independente de tema, persistência e geração por IA.
 */
export const TRAIL_LANDMARKS = [
  { id: 'library', label: 'Biblioteca', purpose: 'Aulas e ensino' },
  { id: 'targets', label: 'Campo de Alvos', purpose: 'Exercícios' },
  { id: 'flashcard-chest', label: 'Baú de Flashcards', purpose: 'Memorização e revisão' },
  { id: 'laboratory', label: 'Laboratório', purpose: 'Prática e aplicação' },
  { id: 'castle', label: 'Castelo', purpose: 'Avaliação e consolidação' },
] as const;

export type TrailLandmarkId = (typeof TRAIL_LANDMARKS)[number]['id'];
export type TrailActivityKind = 'landmark' | 'quick-challenge' | 'flashcards' | 'review';
export type TrailAvailability = 'available' | 'preparation-needed' | 'insufficient-content' | 'progression-locked' | 'offline';
export type TrailCompletion = 'not-started' | 'completed' | 'skipped';

export interface TrailNode {
  id: string;
  chapterId: string;
  kind: TrailActivityKind;
  landmarkId?: TrailLandmarkId;
  title: string;
  availability: TrailAvailability;
  completion: TrailCompletion;
}

export interface TrailChapter {
  id: string;
  disciplineId: string;
  title: string;
  nodes: TrailNode[];
}

/** Pular uma etapa registra a passagem sem conceder aprovação. */
export function canSkipTrailNode(_node: TrailNode): boolean {
  return true;
}

/** Conclusão de percurso não deve ser confundida com domínio pedagógico estimado. */
export function summarizeTrailCompletion(nodes: readonly TrailNode[]) {
  const completed = nodes.filter((node) => node.completion === 'completed').length;
  const skipped = nodes.filter((node) => node.completion === 'skipped').length;
  return {
    completed,
    skipped,
    total: nodes.length,
    completionPercent: nodes.length === 0 ? 0 : Math.round((completed / nodes.length) * 100),
  };
}

/** Mantém as cinco construções visíveis mesmo quando faltam materiais. */
export function getVisibleLandmarks(nodes: readonly TrailNode[]) {
  return TRAIL_LANDMARKS.map((landmark) => ({
    ...landmark,
    node: nodes.find((node) => node.kind === 'landmark' && node.landmarkId === landmark.id),
  }));
}

export const TRAIL_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export function requiredTrailQuestions(activity: NonNullable<StudyQuizAttempt['trail']>['activity']) {
  return activity === 'quiz' ? 10 : activity === 'verify' ? 3 : undefined;
}

export function minimumTrailCorrect(activity: NonNullable<StudyQuizAttempt['trail']>['activity'], total: number) {
  return activity === 'verify' ? 2 : Math.ceil(total * 0.8);
}

export function passesTrailAttempt(attempt: StudyQuizAttempt) {
  if (!attempt.trail || !attempt.totalQuestions || attempt.answers.length !== attempt.totalQuestions) return false;
  const required = requiredTrailQuestions(attempt.trail.activity);
  return (!required || attempt.totalQuestions === required) &&
    attempt.correctAnswers >= minimumTrailCorrect(attempt.trail.activity, attempt.totalQuestions);
}

export function unlockedTargetLevel(level: StudyQuestionDifficulty, attempts: StudyQuizAttempt[]) {
  return TRAIL_DIFFICULTIES.slice(0, TRAIL_DIFFICULTIES.indexOf(level)).every(difficulty =>
    attempts.some(attempt => attempt.trail?.activity === 'quiz' &&
      attempt.trail.difficulty === difficulty && passesTrailAttempt(attempt)));
}

type Resources = { lessons: boolean; questions: number; cards: number; targetQuestions: number; targetUnlocked: boolean; attempts: number };
export function buildTrailChapter(
  id: string,
  disciplineId: string,
  title: string,
  resources: Resources,
): TrailChapter {
  const { lessons, questions, cards, targetQuestions, targetUnlocked, attempts } = resources;
  const stops: [string, TrailActivityKind, string, boolean][] = [
    ['library', 'landmark', '', lessons],
    ['quick', 'quick-challenge', 'Desafio rápido', questions > 0],
    ['targets', 'landmark', '', targetQuestions >= 10],
    ['recall', 'flashcards', 'Recordar conceitos', cards > 0],
    ['flashcard-chest', 'landmark', '', cards > 0 && questions >= 3],
    ['review', 'review', 'Revisar tentativas', attempts > 0],
    ['laboratory', 'landmark', '', true],
    ['warmup', 'flashcards', 'Revisão antes do simulado', cards > 0],
    ['castle', 'landmark', '', questions > 0],
  ];
  return {
    id,
    disciplineId,
    title,
    nodes: stops.map(([key, kind, label, available]) => {
      const landmark = TRAIL_LANDMARKS.find((item) => item.id === key);
      return {
        id: key,
        chapterId: id,
        kind,
        landmarkId: landmark?.id,
        title: landmark?.label ?? label,
        availability: key === 'targets' && !targetUnlocked ? 'progression-locked' : available
          ? 'available'
          : key === 'library' || key === 'review'
            ? 'preparation-needed'
            : 'insufficient-content',
        completion: 'not-started',
      };
    }),
  };
}
