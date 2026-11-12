export type StudyLearningContext = 'technical' | 'football' | 'sports' | 'series' | 'games' | 'daily';

export interface StudyLearningProgress {
  id: string;
  disciplineId: string;
  lessonId: string;
  completedAt: string;
  context: StudyLearningContext;
}

export interface StudyLearningUnit {
  id: string;
  disciplineId: string;
  topicId?: string;
  topicTitle?: string;
  sourceFileName?: string;
  concept: string;
  formalExplanation: string;
  sourceExcerpt?: string;
  analogy: string;
  bridge: string;
  reviewReason: 'new' | 'weak-topic' | 'due-review';
  completed: boolean;
}

export const studyLearningContexts: Array<{ value: StudyLearningContext; label: string; description: string }> = [
  { value: 'technical', label: 'Técnico', description: 'Definições diretas e exemplos de sistema.' },
  { value: 'football', label: 'Futebol', description: 'Times, posições, treino e jogo.' },
  { value: 'sports', label: 'Esportes', description: 'Treino, estratégia e desempenho.' },
  { value: 'series', label: 'Séries e filmes', description: 'Personagens, cenas e temporadas.' },
  { value: 'games', label: 'Jogos', description: 'Fases, regras, mecânicas e progressão.' },
  { value: 'daily', label: 'Cotidiano', description: 'Situações práticas do dia a dia.' },
];
