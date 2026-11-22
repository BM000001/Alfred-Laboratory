/**
 * Alfred Studies 2.2 — modelo inicial da trilha.
 * Camada pura e independente de tema, persistência e geração por IA.
 * Não altera o fluxo legado de Studies até integração e validação no iPhone.
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
export type TrailAvailability = 'available' | 'preparation-needed' | 'insufficient-content' | 'offline';
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

/** Não há bloqueio de nível ou de nota: todas as atividades podem ser abertas ou puladas. */
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

type Resources = { lessons: boolean; questions: number; cards: number; sourced: number; attempts: number };
export function buildTrailChapter(
  id: string,
  disciplineId: string,
  title: string,
  resources: Resources,
): TrailChapter {
  const { lessons, questions, cards, sourced, attempts } = resources;
  const stops: [string, TrailActivityKind, string, boolean][] = [
    ['library', 'landmark', '', lessons],
    ['quick', 'quick-challenge', 'Desafio rápido', questions > 0],
    ['targets', 'landmark', '', questions > 0],
    ['recall', 'flashcards', 'Recordar conceitos', cards > 0],
    ['flashcard-chest', 'landmark', '', cards > 0],
    ['review', 'review', 'Revisar tentativas', attempts > 0],
    ['laboratory', 'landmark', '', sourced > 0],
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
        availability: available
          ? 'available'
          : key === 'library' || key === 'review'
            ? 'preparation-needed'
            : 'insufficient-content',
        completion: 'not-started',
      };
    }),
  };
}
