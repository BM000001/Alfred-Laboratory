import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';

export type IslandActivity = 'practice' | 'memory' | 'lab' | 'castle';

export const activities = {
  practice: { title: 'Questões e simulados', limit: 10 },
  memory: { title: 'Desafio de três cartões', limit: 3 },
  lab: { title: 'Aplicação com fonte', limit: 10 },
  castle: { title: 'Simulado final', limit: 50 },
} as const;

export function passed(attempt: StudyQuizAttempt) {
  if (!attempt.totalQuestions || attempt.answers.length !== attempt.totalQuestions) return false;
  return attempt.activity === 'memory'
    ? attempt.totalQuestions === 3 && attempt.correctAnswers >= 2
    : attempt.correctAnswers * 5 >= attempt.totalQuestions * 4;
}

// Use the learner's own backs as alternatives. Ambiguous fronts cannot be graded.
export function flashcardQuestions(cards: StudyFlashcard[]): StudyQuestion[] {
  const key = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
  const answers = new Map<string, string>();
  const fronts = new Map<string, Set<string>>();
  for (const card of cards) {
    const front = key(card.front), back = key(card.back);
    if (!front || !back) continue;
    answers.set(back, card.back);
    const values = fronts.get(front) ?? new Set<string>();
    values.add(back);
    fronts.set(front, values);
  }
  const seen = new Set<string>();
  return cards.flatMap((card, index) => {
    const front = key(card.front), back = key(card.back);
    if (!back || fronts.get(front)?.size !== 1 || seen.has(front)) return [];
    const options = [...answers].filter(([answer]) => answer !== back).slice(0, 2).map(([, value]) => value);
    if (!options.length) return [];
    seen.add(front);
    const correctOptionIndex = index % (options.length + 1);
    options.splice(correctOptionIndex, 0, card.back);
    return [{ id: 'card:' + card.id, topicId: card.topicId, disciplineId: card.disciplineId,
      prompt: card.front, options, correctOptionIndex, createdAt: card.createdAt, difficulty: 'medium',
      sourceExcerpt: card.sourceExcerpt, sourceFileName: card.sourceFileName }];
  });
}
