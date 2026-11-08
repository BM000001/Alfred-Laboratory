import type { EntityRepository } from '../../storage/repositories';
import type { CreateStudyQuestionInput, StudyQuestion, StudyQuizAttempt, StudyQuizAnswer } from './questionTypes';

type Options = { createId?: () => string; now?: () => Date };

export function gradeStudyAnswer(question: Pick<StudyQuestion, 'correctOptionIndex'>, selectedOptionIndex: number | null): StudyQuizAnswer['isCorrect'] {
  return selectedOptionIndex !== null && selectedOptionIndex === question.correctOptionIndex;
}

export function summarizeQuiz(answers: StudyQuizAnswer[]) {
  const correct = answers.filter((answer) => answer.isCorrect).length;
  return { total: answers.length, correct, incorrect: answers.length - correct, percentage: answers.length ? Math.round(correct / answers.length * 100) : 0 };
}

export function createQuestionService(
  questions: EntityRepository<StudyQuestion>,
  attempts: EntityRepository<StudyQuizAttempt>,
  options: Options = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    list: () => questions.getAll(),
    listAttempts: () => attempts.getAll(),
    async create(input: CreateStudyQuestionInput) {
      const prompt = input.prompt.trim();
      const choices = input.options.map((option) => option.trim());
      const explanation = input.explanation?.trim() ?? '';
      if (!input.disciplineId) throw new Error('Selecione uma disciplina.');
      if (!prompt) throw new Error('Escreva o enunciado da questão.');
      if (prompt.length > 1000) throw new Error('O enunciado aceita até 1.000 caracteres.');
      if (choices.length < 2 || choices.length > 6 || choices.some((choice) => !choice)) throw new Error('Informe de 2 a 6 alternativas e preencha todas.');
      if (choices.some((choice) => choice.length > 300)) throw new Error('Cada alternativa aceita até 300 caracteres.');
      if (!Number.isInteger(input.correctOptionIndex) || input.correctOptionIndex < 0 || input.correctOptionIndex >= choices.length) throw new Error('Marque qual alternativa está correta.');
      if (explanation.length > 2000) throw new Error('A explicação aceita até 2.000 caracteres.');
      const question: StudyQuestion = {
        id: createId(),
        disciplineId: input.disciplineId,
        ...(input.topicId ? { topicId: input.topicId } : {}),
        prompt,
        options: choices,
        correctOptionIndex: input.correctOptionIndex,
        ...(explanation ? { explanation } : {}),
        difficulty: input.difficulty,
        createdAt: now().toISOString(),
      };
      await questions.save(question);
      return question;
    },
    async delete(id: string) {
      if (!(await questions.getById(id))) throw new Error('Questão não encontrada.');
      await questions.delete(id);
    },
    async saveAttempt(attempt: StudyQuizAttempt) {
      if (!attempt.disciplineId || !attempt.answers.length || attempt.totalQuestions !== attempt.answers.length) throw new Error('A tentativa de simulado está incompleta.');
      const summary = summarizeQuiz(attempt.answers);
      if (summary.correct !== attempt.correctAnswers) throw new Error('O resultado da tentativa não confere.');
      await attempts.save(attempt);
    },
  };
}

export function selectQuizQuestions(
  questions: StudyQuestion[],
  options: { topicId?: string; difficulty?: StudyQuestion['difficulty'] | 'all'; limit?: number; random?: () => number } = {},
): StudyQuestion[] {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 10)));
  const candidates = questions.filter(question =>
    (!options.topicId || question.topicId === options.topicId) &&
    (!options.difficulty || options.difficulty === 'all' || question.difficulty === options.difficulty),
  );
  const shuffled = [...candidates];
  const random = options.random ?? Math.random;
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}
