export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardReviewEvent {
  ratedAt: string;
  rating: FlashcardRating;
  intervalDays: number;
  nextReviewAt: string;
}

export interface StudyFlashcard {
  id: string;
  disciplineId: string;
  front: string;
  back: string;
  createdAt: string;
  lastReviewedAt?: string;
  nextReviewAt: string;
  intervalDays: number;
  reviewCount: number;
  /** Bounded event history. Optional so cards saved by older Alfred versions remain readable. */
  reviewHistory?: FlashcardReviewEvent[];
  topicId?: string;
  sourceExcerpt?: string;
  confidence?: number;
  sourceFileId?: string;
  sourceFileName?: string;
  subject?: string;
}

export type CreateFlashcardInput = Pick<StudyFlashcard, 'disciplineId' | 'front' | 'back'> & Partial<Pick<StudyFlashcard, 'topicId' | 'sourceFileId' | 'sourceFileName' | 'subject'>>;
