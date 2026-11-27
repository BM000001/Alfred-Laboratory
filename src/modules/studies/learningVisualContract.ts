import type { StudySourceChunk } from './studyRemoteQuestions';

export type VisualLearningKind = 'mind-map' | 'storyboard' | 'interactive';
export interface GroundedFrame {
  title: string;
  description: string;
  chunkId: string;
  excerpt: string;
  parent?: number;
  choices?: string[];
  correctChoice?: number;
  feedback?: string;
}
export interface VisualLearningDraft {
  version: 1;
  kind: VisualLearningKind;
  frames: GroundedFrame[];
}
const bounded = (value: unknown, max: number): value is string =>
  typeof value === 'string' && !!value.trim() && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Only inert, source-grounded data leaves this boundary. A draft still requires review.
export function readVisualLearningDraft(value: unknown, kind: VisualLearningKind, chunks: StudySourceChunk[]): VisualLearningDraft {
  if (!record(value) || value.version !== 1 || value.kind !== kind || !Array.isArray(value.frames)
      || !value.frames.length || value.frames.length > 12) throw new Error('Formato de atividade inválido.');
  const sources = new Map(chunks.map(chunk => [chunk.chunkId, chunk.text]));
  const frames = value.frames.map((frame: unknown, index: number): GroundedFrame => {
    if (!record(frame) || !bounded(frame.title, 120) || !bounded(frame.description, 1000) ||
        !bounded(frame.chunkId, 80) || !bounded(frame.excerpt, 1000) ||
        !sources.get(frame.chunkId)?.includes(frame.excerpt)) throw new Error('Quadro sem referência verificável.');
    const result: GroundedFrame = { title: frame.title, description: frame.description, chunkId: frame.chunkId, excerpt: frame.excerpt };
    if (kind === 'mind-map' && index > 0) {
      const parent = frame.parent;
      if (typeof parent !== 'number' || !Number.isInteger(parent) || parent < 0 || parent >= index) throw new Error('Ligação inválida no mapa.');
      result.parent = parent;
    }
    if (kind === 'interactive') {
      const { choices, correctChoice, feedback } = frame;
      if (!Array.isArray(choices) || choices.length < 2 || choices.length > 5 || !choices.every(c => bounded(c, 300)) ||
          new Set(choices.map(c => c.trim().toLocaleLowerCase('pt-BR'))).size !== choices.length ||
          typeof correctChoice !== 'number' || !Number.isInteger(correctChoice) || correctChoice < 0 || correctChoice >= choices.length ||
          !bounded(feedback, 1000)) throw new Error('Interação sem correção verificável.');
      Object.assign(result, { choices: [...choices], correctChoice, feedback });
    }
    return result;
  });
  return { version: 1, kind, frames };
}
