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
  topicId?: string;
  sourceFileId?: string;
  sourceFileName?: string;
  subject?: string;
}

export type CreateFlashcardInput = Pick<StudyFlashcard, 'disciplineId' | 'front' | 'back'> & Partial<Pick<StudyFlashcard, 'topicId' | 'sourceFileId' | 'sourceFileName' | 'subject'>>;
