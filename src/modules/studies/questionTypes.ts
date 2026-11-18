export type StudyQuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface StudyQuestion {
  id: string;
  disciplineId: string;
  topicId?: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
  difficulty: StudyQuestionDifficulty;
  createdAt: string;
  sourceExcerpt?: string;
  confidence?: number;
  sourceFileId?: string;
  sourceFileName?: string;
  subject?: string;
}

export interface CreateStudyQuestionInput {
  disciplineId: string;
  topicId?: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
  difficulty: StudyQuestionDifficulty;
  sourceFileId?: string;
  sourceFileName?: string;
  subject?: string;
}

export interface StudyQuizAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  questionSnapshot?: Omit<StudyQuestion, 'id' | 'disciplineId' | 'createdAt'>
    & Partial<Pick<StudyQuestion, 'id' | 'disciplineId' | 'createdAt'>>;
}

export interface StudyQuizAttempt {
  id: string;
  disciplineId: string;
  startedAt: string;
  completedAt: string;
  totalQuestions: number;
  correctAnswers: number;
  answers: StudyQuizAnswer[];
}
