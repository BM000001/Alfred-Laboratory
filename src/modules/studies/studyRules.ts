import type { Discipline, StudyTopic } from './types';

export const DISCIPLINE_NAME_MAX_LENGTH = 80;
export const STUDY_TOPIC_TITLE_MAX_LENGTH = 120;

export function validateDisciplineName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'O nome da disciplina é obrigatório.';
  if (value.length > DISCIPLINE_NAME_MAX_LENGTH) return `O nome da disciplina deve ter no máximo ${DISCIPLINE_NAME_MAX_LENGTH} caracteres.`;
  return null;
}

export function validateStudyTopic(topic: Pick<StudyTopic, 'disciplineId' | 'title'>, disciplines: Discipline[]): string | null {
  if (!disciplines.some((discipline) => discipline.id === topic.disciplineId)) return 'Selecione uma disciplina válida.';
  const title = topic.title.trim();
  if (!title) return 'O título do conteúdo é obrigatório.';
  if (title.length > STUDY_TOPIC_TITLE_MAX_LENGTH) return `O título deve ter no máximo ${STUDY_TOPIC_TITLE_MAX_LENGTH} caracteres.`;
  return null;
}

export function summarizeStudyProgress(topics: StudyTopic[]) {
  const completed = topics.filter((topic) => topic.status === 'completed').length;
  return { total: topics.length, completed, pending: topics.length - completed, percentage: topics.length ? Math.round(completed / topics.length * 100) : 0 };
}
