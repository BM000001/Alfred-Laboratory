import { fileRepository, studyFlashcardRepository, studyQuestionRepository } from '../../storage/repositories';
import { saveValidatedAIStudyQuestions } from './studyAIQuestionStore';
import type { ValidatedAIStudyPack } from './studyRemotePack';

type SavePackArgs = {
  fileId: string;
  fileName: string;
  disciplineId: string;
  topicId: string;
  sourceText: string;
  pack: ValidatedAIStudyPack;
  signal: AbortSignal;
  onSaved?: (kind: 'questions' | 'lessons' | 'flashcards', count: number) => void;
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/gu, ' ');
}
function fingerprint(value: string): string {
  let hash = 2166136261;
  for (const ch of value) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Save only original-source-backed AI output, without changing the IndexedDB schema. */
export async function saveValidatedAIStudyPack({
  fileId, fileName, disciplineId, topicId, sourceText, pack, signal, onSaved,
}: SavePackArgs) {
  if (!fileId || !disciplineId || !topicId || !sourceText) throw new Error('Material original indisponível.');
  const questionsAdded = await saveValidatedAIStudyQuestions({
    fileId, fileName, disciplineId, topicId, sourceText, questions: pack.questions, signal,
  });
  onSaved?.('questions', questionsAdded);

  const existingCards = await studyFlashcardRepository.getAll();
  const cardKeys = new Set(existingCards.filter(c => c.disciplineId === disciplineId && c.topicId === topicId).map(c => normalize(c.front)));
  const cardIds = new Set(existingCards.map(c => c.id));
  let flashcardsAdded = 0;
  for (const card of pack.flashcards) {
    signal.throwIfAborted();
    if (!sourceText.includes(card.sourceExcerpt) || !normalize(card.sourceExcerpt).includes(normalize(card.back))) continue;
    const key = normalize(card.front);
    const id = 'ai:' + fileId + ':card:' + fingerprint(card.front + ':' + card.sourceExcerpt);
    if (cardKeys.has(key) || cardIds.has(id)) continue;
    const createdAt = new Date().toISOString();
    await studyFlashcardRepository.save({
      id, disciplineId, topicId, sourceFileId: fileId, sourceFileName: fileName,
      sourceExcerpt: card.sourceExcerpt, front: card.front, back: card.back,
      createdAt, nextReviewAt: createdAt, intervalDays: 0, reviewCount: 0,
    });
    cardKeys.add(key); cardIds.add(id);
    flashcardsAdded++;
  }
  onSaved?.('flashcards', flashcardsAdded);

  signal.throwIfAborted();
  const file = await fileRepository.getById(fileId);
  if (!file?.processing || file.disciplineId !== disciplineId || file.processing.topicId !== topicId) {
    throw new Error('O material ou vínculo da unidade mudou antes de salvar as aulas.');
  }
  const lessons = file.processing.aiLessons ?? [];
  const lessonIds = new Set(lessons.map(lesson => lesson.id));
  const lessonTitles = new Set(lessons.map(lesson => normalize(lesson.title)));
  const now = new Date().toISOString();
  let lessonsAdded = 0;
  for (const lesson of pack.lessons) {
    if (!sourceText.includes(lesson.sourceExcerpt) || !normalize(lesson.sourceExcerpt).includes(normalize(lesson.answer))) continue;
    const id = 'ai:' + fileId + ':lesson:' + fingerprint(lesson.title + ':' + lesson.sourceExcerpt);
    if (lessonIds.has(id) || lessonTitles.has(normalize(lesson.title))) continue;
    lessons.push({ ...lesson, id, createdAt: now });
    lessonIds.add(id); lessonTitles.add(normalize(lesson.title));
    lessonsAdded++;
  }
  if (lessonsAdded) {
    signal.throwIfAborted();
    await fileRepository.save({ ...file, processing: { ...file.processing, aiLessons: lessons } });
  }
  onSaved?.('lessons', lessonsAdded);
  const updated = await fileRepository.getById(fileId);
  const readyQuestions = (await studyQuestionRepository.getAll()).some(item =>
    item.disciplineId === disciplineId && item.topicId === topicId && item.sourceFileId === fileId);
  const readyCards = (await studyFlashcardRepository.getAll()).some(item =>
    item.disciplineId === disciplineId && item.topicId === topicId && item.sourceFileId === fileId);
  if (updated?.processing?.aiLessons?.length && readyQuestions && readyCards) {
    signal.throwIfAborted();
    await fileRepository.save({
      ...updated,
      processing: { ...updated.processing, status: 'completed', stage: 'Aulas, questões e flashcards preparados por IA.' },
    });
  }
  return { questionsAdded, flashcardsAdded, lessonsAdded };
}
