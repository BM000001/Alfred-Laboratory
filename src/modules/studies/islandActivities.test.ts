import { expect, it } from 'vitest';
import { flashcardQuestions, passed } from './islandActivities';
import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuizAttempt } from './questionTypes';

function attempt(correct: number, total: number, activity: StudyQuizAttempt['activity'], answered = total): StudyQuizAttempt {
  return { activity, disciplineId: 'd', id: 'a', startedAt: '', completedAt: '', correctAnswers: correct,
    totalQuestions: total, answers: Array.from({length:answered}, (_,i) => ({questionId:String(i),isCorrect:i<correct,selectedOptionIndex:0})) };
}
it('requires a complete session and uses the exact threshold', () => {
  for (const mode of ['castle','practice','lab'] as const) {
    expect(passed(attempt(8,10,mode))).toBe(true);
    expect(passed(attempt(7,10,mode))).toBe(false);
    expect(passed(attempt(8,10,mode,8))).toBe(false);
  }
  expect(passed(attempt(2,3,'memory'))).toBe(true);
  expect(passed(attempt(2,2,'memory'))).toBe(false);
});
it('builds a challenge only from unambiguous saved cards', () => {
  function card(front:string,back:string):StudyFlashcard {
    return {id:front+back, disciplineId:'d',topicId:'u',front,back,createdAt:'',nextReviewAt:'',intervalDays:0,reviewCount:0};
  }
  const cards=[card('A','X'),card('B','Y'),card('C','Z'),card('A','X'),card('D','X'),card('D','Y')];
  const result=flashcardQuestions(cards);
  expect(result.map(q=>q.prompt)).toEqual(['A','B','C']);
  result.forEach((q,i)=>{expect(q.options[q.correctOptionIndex]).toBe(cards[i].back);expect(new Set(q.options).size).toBe(3);});
});
