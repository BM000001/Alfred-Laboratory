export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

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
}

export type CreateFlashcardInput = Pick<StudyFlashcard, 'disciplineId' | 'front' | 'back'>;
