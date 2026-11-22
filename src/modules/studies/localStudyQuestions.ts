import type { StoredFile } from '../files/types';
import { normalizeMaterial, relevantAmbiguities } from './materialReliability';
import type { StudyEnhancementProvider, StudyEnhancementRequest, SuggestedQuestion } from './studyEnhancementProvider';
import { validateStudyEnhancement } from './studyEnhancementValidation';
import type { StudyTopic } from './types';

export function prepareLocalStudyQuestions(file: StoredFile, topic: StudyTopic, focus = '', batch = 0) {
  const extraction = file.processing?.raw ?? file.extraction;
  const source = { id: file.id, disciplineId: file.disciplineId, text: extraction?.text ?? '', pages: extraction?.pages };
  const candidates = (source.pages?.length ? source.pages : [{ text: source.text, pageNumber: undefined }])
    .flatMap(({ text, pageNumber }) => {
      let heading = '';
      return text.split(/\n(?=#{1,6}\s)|\n\s*\n/).flatMap(paragraph => {
        const title = paragraph.match(/^#{1,6}\s+([^\n]+)/);
        if (title) heading = title[1];
        if (focus.trim() && !normalizeMaterial(heading + ' ' + paragraph).includes(normalizeMaterial(focus.trim()))) return [];
        return (paragraph.match(/[\s\S]{1,1200}/g) ?? []).map(part => ({text: part.trim(), pageNumber}));
      });
    }).filter(chunk => chunk.text.length >= 40 && chunk.text.length <= 1200);
  const chunks = candidates.slice(batch * 3, batch * 3 + 3)
    .map((chunk, index) => ({ ...chunk, chunkId: 'trecho-' + (index + 1) }));
  if (file.disciplineId !== topic.disciplineId || topic.sourceFileId !== file.id) {
    throw new Error('O material não pertence a esta unidade.');
  }
  if (file.processing?.status === 'review' || relevantAmbiguities(source.text).length) {
    throw new Error('O material contém definições conflitantes. Use uma fonte sem contradições neste piloto.');
  }
  if (!chunks.length) throw new Error('Material insuficiente. Extraia um trecho de estudo antes de gerar.');
  const request: StudyEnhancementRequest = {
    version: 1, requestId: crypto.randomUUID(), sourceFileId: file.id, disciplineId: topic.disciplineId,
    topicId: topic.id, profile: file.processing?.profile ?? 'printed', task: 'questions', chunks,
    consent: { externalProcessing: false, externalAi: false, localAi: true },
  };
  return { request, source, topic, focus, batch, batches: Math.ceil(candidates.length / 3), fileName: file.name };
}

export type LocalQuestionSource = ReturnType<typeof prepareLocalStudyQuestions>;

export async function generateLocalStudyQuestions(
  provider: StudyEnhancementProvider, input: LocalQuestionSource, existingPrompts: readonly string[], signal?: AbortSignal, execution: 'local' | 'remote' = 'local',
) {
  const { request, source, topic } = input;
  const result = await provider.enhance(request, signal);
  signal?.throwIfAborted();
  const prompts = [...existingPrompts];
  const questions: SuggestedQuestion[] = [];
  for (const question of result.questions) {
    const check = validateStudyEnhancement(request, { ...result, questions: [question] },
      { execution: execution === 'local' ? 'local' : undefined, source, topic, existingPrompts: prompts }, signal);
    if (check.status !== 'review' || !question.prompt.trim().endsWith('?')) continue;
    const normalizedPrompt = normalizeMaterial(question.prompt).replace(/[.!?]+$/, '');
    if (request.chunks.some(chunk => normalizeMaterial(chunk.text).replace(/[.!?]+$/, '') === normalizedPrompt)) continue;
    const answer = normalizeMaterial(question.options[question.correctOptionIndex]);
    if (!answer || !question.evidence.some(item => normalizeMaterial(item.excerpt).includes(answer))) continue;
    const answerWithoutPunctuation = answer.replace(/[.!?]+$/, '');
    if (question.options.some((option, index) => index !== question.correctOptionIndex &&
        normalizeMaterial(option).includes(answerWithoutPunctuation))) continue;
    prompts.push(question.prompt);
    questions.push(question);
  }
  return { questions, generated: result.questions.length };
}

export async function localQuestionId(topicId: string, prompt: string) {
  const bytes = new TextEncoder().encode(JSON.stringify([topicId, normalizeMaterial(prompt)]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'ollama-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
