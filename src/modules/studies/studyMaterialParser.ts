import type { StudyQuestionDifficulty } from './questionTypes';

export interface ParsedStudyMaterial {
  flashcards: Array<{ front: string; back: string }>;
  questions: Array<{
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation?: string;
    difficulty: StudyQuestionDifficulty;
  }>;
}

function extractJson(source: string): string {
  const trimmed = source.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseStudyMaterial(source: string): ParsedStudyMaterial {
  if (!source.trim()) throw new Error('O material selecionado está vazio.');
  let value: unknown;
  try { value = JSON.parse(extractJson(source)); }
  catch { throw new Error('Não encontrei JSON válido. Peça à IA para responder no formato JSON indicado no campo de instruções.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('O JSON precisa ser um objeto com "flashcards" e/ou "questions".');
  const record = value as Record<string, unknown>;
  const flashcardsRaw = record.flashcards ?? [];
  const questionsRaw = record.questions ?? [];
  if (!Array.isArray(flashcardsRaw) || !Array.isArray(questionsRaw)) throw new Error('"flashcards" e "questions" precisam ser listas.');
  if (!flashcardsRaw.length && !questionsRaw.length) throw new Error('O material não contém flashcards ou questões para importar.');
  if (flashcardsRaw.length > 100 || questionsRaw.length > 100) throw new Error('Importe no máximo 100 flashcards e 100 questões por vez.');

  const flashcards = flashcardsRaw.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Flashcard ${index + 1}: formato inválido.`);
    const card = item as Record<string, unknown>;
    if (typeof card.front !== 'string' || !card.front.trim() || card.front.length > 500) throw new Error(`Flashcard ${index + 1}: "front" é obrigatório e aceita até 500 caracteres.`);
    if (typeof card.back !== 'string' || !card.back.trim() || card.back.length > 2000) throw new Error(`Flashcard ${index + 1}: "back" é obrigatório e aceita até 2.000 caracteres.`);
    return { front: card.front.trim(), back: card.back.trim() };
  });

  const questions = questionsRaw.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Questão ${index + 1}: formato inválido.`);
    const question = item as Record<string, unknown>;
    if (typeof question.prompt !== 'string' || !question.prompt.trim() || question.prompt.length > 1000) throw new Error(`Questão ${index + 1}: "prompt" é obrigatório e aceita até 1.000 caracteres.`);
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || question.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 300)) throw new Error(`Questão ${index + 1}: informe de 2 a 6 alternativas preenchidas (até 300 caracteres cada).`);
    if (!Number.isInteger(question.correctOptionIndex) || (question.correctOptionIndex as number) < 0 || (question.correctOptionIndex as number) >= question.options.length) throw new Error(`Questão ${index + 1}: "correctOptionIndex" precisa apontar para uma alternativa existente (começa em zero).`);
    if (question.explanation !== undefined && (typeof question.explanation !== 'string' || question.explanation.length > 2000)) throw new Error(`Questão ${index + 1}: "explanation" aceita até 2.000 caracteres.`);
    const difficulty = (question.difficulty ?? 'medium') as StudyQuestionDifficulty;
    if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') throw new Error(`Questão ${index + 1}: dificuldade deve ser easy, medium ou hard.`);
    return {
      prompt: question.prompt.trim(),
      options: (question.options as string[]).map(option => option.trim()),
      correctOptionIndex: question.correctOptionIndex as number,
      ...(typeof question.explanation === 'string' && question.explanation.trim() ? { explanation: question.explanation.trim() } : {}),
      difficulty,
    };
  });
  return { flashcards, questions };
}
