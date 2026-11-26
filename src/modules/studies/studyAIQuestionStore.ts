import { studyQuestionRepository } from '../../storage/repositories';
import type { ValidatedAIStudyQuestion } from './studyRemoteQuestions';

type SaveAIQuestions = {
  fileId: string;
  fileName: string;
  disciplineId: string;
  topicId: string;
  sourceText: string;
  questions: ValidatedAIStudyQuestion[];
  signal: AbortSignal;
  onSaved?: (savedCount: number) => void;
};

function key(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function stableFingerprint(text: string): string {
  // Stable identifier, not a credential or security hash.
  let n = 2166136261;
  for (const char of text) {
    n ^= char.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** Persist only proposals whose evidence was present in the stored original. */
export async function saveValidatedAIStudyQuestions({
  fileId, fileName, disciplineId, topicId, sourceText, questions, signal, onSaved,
}: SaveAIQuestions): Promise<number> {
  if (!fileId || !disciplineId || !topicId || !sourceText) throw new Error('Origem de estudo incompleta.');
  const existing = await studyQuestionRepository.getAll();
  const keys = new Set(existing.filter(q => q.disciplineId === disciplineId && q.topicId === topicId).map(q => key(q.prompt)));
  const ids = new Set(existing.map(q => q.id));
  let count = 0;
  for (const question of questions) {
    signal.throwIfAborted();
    if (!sourceText.includes(question.sourceExcerpt) ||
        question.correctOptionIndex < 0 || question.correctOptionIndex >= question.options.length ||
        !key(question.sourceExcerpt).includes(key(question.options[question.correctOptionIndex]))) continue;
    const promptKey = key(question.prompt);
    if (keys.has(promptKey)) continue;
    const id = 'ai:' + fileId + ':' + stableFingerprint(question.prompt + ':' + question.sourceExcerpt);
    if (ids.has(id)) continue;
    await studyQuestionRepository.save({
      ...question,
      id,
      disciplineId,
      topicId,
      sourceFileId: fileId,
      sourceFileName: fileName,
      createdAt: new Date().toISOString(),
    });
    keys.add(promptKey);
    ids.add(id);
    count++;
    onSaved?.(count);
  }
  return count;
}
