import type { ProcessingProfile } from './materialReliability';
import type { StudyQuestionDifficulty } from './questionTypes';

/**
 * Optional, untrusted semantic enhancement boundary.
 * No network calls, storage writes or AI providers are enabled by this module.
 * The existing offline material processor remains the source of truth.
 */
export interface StudyEvidenceChunk {
  chunkId: string;
  text: string;
  pageNumber?: number;
}

export interface StudyEnhancementRequest {
  version: 1;
  requestId: string;
  sourceFileId: string;
  disciplineId: string;
  topicId: string;
  profile: ProcessingProfile;
  task: 'flashcards' | 'questions' | 'explain';
  chunks: StudyEvidenceChunk[];
  consent: {
    externalProcessing: boolean;
    externalAi: boolean;
    localAi?: boolean;
  };
}

export interface StudyEvidence {
  chunkId: string;
  excerpt: string;
}

export interface SuggestedFlashcard {
  front: string;
  back: string;
  evidence: StudyEvidence[];
}

export interface SuggestedQuestion {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: StudyQuestionDifficulty;
  evidence: StudyEvidence[];
}

export interface StudyEnhancementResult {
  version: 1;
  requestId: string;
  status: 'ready' | 'needs_ai' | 'insufficient_evidence' | 'failed';
  providerKind: 'rules' | 'ai';
  flashcards: SuggestedFlashcard[];
  questions: SuggestedQuestion[];
  explanation?: string;
  evidence: StudyEvidence[];
  warnings: string[];
}

export interface StudyEnhancementProvider {
  enhance(request: StudyEnhancementRequest, signal?: AbortSignal): Promise<StudyEnhancementResult>;
}

/** Safe default: never transmits documents or fabricates study resources. */
export class DisabledStudyEnhancementProvider implements StudyEnhancementProvider {
  async enhance(request: StudyEnhancementRequest, signal?: AbortSignal): Promise<StudyEnhancementResult> {
    signal?.throwIfAborted();
    return {
      version: 1,
      requestId: request.requestId,
      status: request.chunks.some(chunk => chunk.text.trim()) ? 'needs_ai' : 'insufficient_evidence',
      providerKind: 'rules',
      flashcards: [],
      questions: [],
      evidence: [],
      warnings: ['Enriquecimento semântico desativado. O processamento local continua disponível.'],
    };
  }
}
