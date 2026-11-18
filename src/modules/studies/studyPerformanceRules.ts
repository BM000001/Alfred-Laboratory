import { getQuestionSnapshot } from './questionService';
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
  const questionsByTopic = new Map<string, Map<string, QuestionPerformance>>();
  const questionById = new Map(questions.map(question => [question.id, question]));
  function getStats(question: StudyQuestion) {
    if (!question.topicId) return;
    let group = questionsByTopic.get(question.topicId);
    if (!group) {
      group = new Map();
      questionsByTopic.set(question.topicId, group);
    }
    let stats = group.get(question.id);
    if (!stats) {
      stats = {
        questionId: question.id,
        prompt: question.prompt,
        correctAnswer: question.options[question.correctOptionIndex] ?? 'Resposta não disponível',
        ...(question.explanation ? { explanation: question.explanation } : {}),
        answered: 0, correct: 0, incorrect: 0, accuracy: 0,
      };
      group.set(question.id, stats);
    }
    return stats;
  }
  questions.forEach(getStats);
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const question = getQuestionSnapshot(answer, attempt.disciplineId) ?? questionById.get(answer.questionId);
      const stats = question && question.disciplineId === attempt.disciplineId ? getStats(question) : undefined;
      if (!stats) continue;
      stats.answered++;
      if (answer.isCorrect) stats.correct++;
      else stats.incorrect++;
      if (!stats.lastAttemptAt || attempt.completedAt > stats.lastAttemptAt) stats.lastAttemptAt = attempt.completedAt;
    }
  }

  return topics.map(topic => {
    const questionStats = Array.from(questionsByTopic.get(topic.id)?.values() ?? []);
    for (const stats of questionStats) {
      stats.accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
    }
    const answered = questionStats.reduce((sum, item) => sum + item.answered, 0);
    const correct = questionStats.reduce((sum, item) => sum + item.correct, 0);
    const incorrect = answered - correct;
    const lastAttemptAt = questionStats.map(item => item.lastAttemptAt).filter((value): value is string => Boolean(value)).sort().at(-1);
    return {
      topicId: topic.id,
      title: topic.title,
      questionCount: questionStats.length,
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
