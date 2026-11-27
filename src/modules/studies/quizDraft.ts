import { getQuestionSnapshot, gradeStudyAnswer } from './questionService';
import type { StudyQuestion, StudyQuizAnswer } from './questionTypes';

export type QuizDraft = {
  id: string;
  startedAt: string;
  questions: StudyQuestion[];
  answers: StudyQuizAnswer[];
  selected: number | null;
  revealed: boolean;
};

export function readQuizDraft(key: string, disciplineId: string, unitId?: string): QuizDraft | undefined {
  try {
    const draft: QuizDraft = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!draft || typeof draft.id !== 'string' || !/^[\da-f-]{36}$/i.test(draft.id) ||
        typeof draft.startedAt !== 'string' || !Number.isFinite(Date.parse(draft.startedAt)) ||
        !Array.isArray(draft.questions) || !Array.isArray(draft.answers) ||
        draft.questions.length > 50 || draft.answers.length >= draft.questions.length ||
        typeof draft.revealed !== 'boolean') return;
    const options = (index: number, selected: number | null) => Number.isInteger(selected) &&
      selected! >= 0 && selected! < draft.questions[index].options.length;
    const ids = new Set<string>();
    for (const question of draft.questions) {
      if (!question || typeof question.id !== 'string' || ids.has(question.id) ||
          question.disciplineId !== disciplineId || (unitId && question.topicId !== unitId) ||
          !getQuestionSnapshot({ questionId: question.id, questionSnapshot: question, isCorrect: false, selectedOptionIndex: null }, disciplineId)) return;
      ids.add(question.id);
    }
    if ((draft.selected !== null || draft.revealed) && !options(draft.answers.length, draft.selected)) return;
    const answers = [];
    for (const [index, answer] of draft.answers.entries()) {
      const question = draft.questions[index];
      if (!answer || answer.questionId !== question.id || (answer.selectedOptionIndex !== null && !options(index, answer.selectedOptionIndex))) return;
      answers.push({ questionId: question.id, selectedOptionIndex: answer.selectedOptionIndex,
        isCorrect: gradeStudyAnswer(question, answer.selectedOptionIndex), questionSnapshot: question });
    }
    return { ...draft, answers };
  } catch {
    return undefined;
  }
}

export function writeQuizDraft(key: string, draft: QuizDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}


export function clearQuizDraft(key: string, id: string) {
  try {
    if (JSON.parse(localStorage.getItem(key) ?? 'null')?.id === id) localStorage.removeItem(key);
  } catch {
    // A completed attempt is resilient to a stale draft at the next mount.
  }
}
