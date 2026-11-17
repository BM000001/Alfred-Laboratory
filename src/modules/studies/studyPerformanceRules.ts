import type { StudyTopic } from './types';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';

export interface QuestionPerformance {
  questionId: string;
  prompt: string;
  correctAnswer: string;
  explanation?: string;
  answered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  lastAttemptAt?: string;
}

export interface TopicPerformance {
  topicId: string;
  title: string;
  questionCount: number;
  answered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  lastAttemptAt?: string;
  questions: QuestionPerformance[];
}

export function summarizeStudyPerformance(
  topics: StudyTopic[],
  questions: StudyQuestion[],
  attempts: StudyQuizAttempt[],
): TopicPerformance[] {
  const questionsByTopic = new Map<string, StudyQuestion[]>();
  const questionById = new Map(questions.map(question => [question.id, question]));
  for (const question of questions) {
    if (!question.topicId) continue;
    const group = questionsByTopic.get(question.topicId) ?? [];
    group.push(question);
    questionsByTopic.set(question.topicId, group);
  }

  const perQuestion = new Map<string, { answered: number; correct: number; incorrect: number; lastAttemptAt?: string }>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      if (!questionById.has(answer.questionId)) continue;
      const current = perQuestion.get(answer.questionId) ?? { answered: 0, correct: 0, incorrect: 0 };
      current.answered++;
      if (answer.isCorrect) current.correct++;
      else current.incorrect++;
      if (!current.lastAttemptAt || attempt.completedAt > current.lastAttemptAt) current.lastAttemptAt = attempt.completedAt;
      perQuestion.set(answer.questionId, current);
    }
  }

  return topics.map(topic => {
    const topicQuestions = questionsByTopic.get(topic.id) ?? [];
    const questionStats: QuestionPerformance[] = topicQuestions.map(question => {
      const stats = perQuestion.get(question.id) ?? { answered: 0, correct: 0, incorrect: 0 };
      return {
        questionId: question.id,
        prompt: question.prompt,
        correctAnswer: question.options[question.correctOptionIndex] ?? 'Resposta não disponível',
        ...(question.explanation ? { explanation: question.explanation } : {}),
        ...stats,
        accuracy: stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0,
      };
    });
    const answered = questionStats.reduce((sum, item) => sum + item.answered, 0);
    const correct = questionStats.reduce((sum, item) => sum + item.correct, 0);
    const incorrect = answered - correct;
    const lastAttemptAt = questionStats.map(item => item.lastAttemptAt).filter((value): value is string => Boolean(value)).sort().at(-1);
    return {
      topicId: topic.id,
      title: topic.title,
      questionCount: topicQuestions.length,
      answered,
      correct,
      incorrect,
      accuracy: answered ? Math.round(correct / answered * 100) : 0,
      ...(lastAttemptAt ? { lastAttemptAt } : {}),
      questions: questionStats.sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy),
    };
  }).filter(topic => topic.questionCount > 0).sort((a, b) => {
    if (!a.answered && !b.answered) return a.title.localeCompare(b.title, 'pt-BR');
    if (!a.answered) return 1;
    if (!b.answered) return -1;
    return a.accuracy - b.accuracy || b.incorrect - a.incorrect;
  });
}
