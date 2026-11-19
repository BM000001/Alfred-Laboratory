import { normalizeMaterial } from './materialReliability';
import type { StudyEnhancementRequest } from './studyEnhancementProvider';

type Source = { id: string; disciplineId?: string; text: string; pages?: readonly { pageNumber: number; text: string }[] };
type Context = {
  source: Source;
  topic: { id: string; disciplineId: string; sourceFileId?: string };
  existingFronts?: readonly string[];
  existingPrompts?: readonly string[];
};
type Decision = { status: 'rejected' | 'review' | 'empty'; issues: string[] };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.length <= max && Boolean(value.trim());

/** Checks local provenance independently of the provider. Review is required even for literal evidence. */
export function validateStudyEnhancement(request: StudyEnhancementRequest, result: unknown, context: Context): Decision {
  const rejected = (issue: string): Decision => ({ status: 'rejected', issues: [issue] });
  const { source, topic } = context;
  if (source.id !== request.sourceFileId || source.disciplineId !== request.disciplineId ||
      topic.id !== request.topicId || topic.disciplineId !== request.disciplineId || topic.sourceFileId !== source.id) {
    return rejected('source_scope');
  }
  const chunks = new Map<string, string>();
  if (request.chunks.length > 24) return rejected('chunk_scope');
  for (const chunk of request.chunks) {
    const original = chunk.pageNumber === undefined ? source.text : source.pages?.find(page => page.pageNumber === chunk.pageNumber)?.text;
    if (!text(chunk.chunkId, 128) || !text(chunk.text, 4000) || chunks.has(chunk.chunkId) || !original?.includes(chunk.text)) {
      return rejected('chunk_scope');
    }
    chunks.set(chunk.chunkId, chunk.text);
  }
  if (!record(result) || result.version !== 1 || result.requestId !== request.requestId ||
      !['ready', 'needs_ai', 'insufficient_evidence', 'failed'].includes(String(result.status)) ||
      !['rules', 'ai'].includes(String(result.providerKind)) ||
      !Array.isArray(result.flashcards) || !Array.isArray(result.questions) || !Array.isArray(result.evidence) ||
      !Array.isArray(result.warnings) || result.warnings.length > 20 || result.warnings.some(item => !text(item, 500)) ||
      result.flashcards.length > 30 || result.questions.length > 30) return rejected('result_shape');

  const hasEvidence = (value: unknown): boolean => Array.isArray(value) && value.length > 0 && value.length <= 8 &&
    value.every(item => record(item) && text(item.chunkId, 128) && text(item.excerpt) &&
      chunks.get(item.chunkId)?.includes(item.excerpt));
  const { flashcards, questions, explanation, evidence } = result;
  if (result.status !== 'ready') {
    return flashcards.length || questions.length || explanation !== undefined || evidence.length
      ? rejected('unexpected_content') : { status: 'empty', issues: [] };
  }
  if ((request.task !== 'flashcards' || !flashcards.length) &&
      (request.task !== 'questions' || !questions.length) &&
      (request.task !== 'explain' || explanation === undefined)) return rejected('empty_result');
  if ((flashcards.length && request.task !== 'flashcards') || (questions.length && request.task !== 'questions') ||
      (explanation !== undefined && request.task !== 'explain')) return rejected('unexpected_content');
  if ((evidence.length > 0 && !hasEvidence(evidence)) ||
      (explanation !== undefined && (!text(explanation) || !hasEvidence(evidence)))) return rejected('explanation_evidence');

  const fronts = new Set(context.existingFronts?.map(normalizeMaterial));
  const prompts = new Set(context.existingPrompts?.map(normalizeMaterial));
  for (const card of flashcards) {
    if (!record(card) || !text(card.front, 500) || !text(card.back)) return rejected('flashcard_shape');
    if (!hasEvidence(card.evidence)) return rejected('flashcard_evidence');
    const key = normalizeMaterial(card.front);
    if (!key || fronts.has(key)) return rejected('duplicate_flashcard');
    fronts.add(key);
  }
  for (const question of questions) {
    if (!record(question) || !text(question.prompt, 500) || !text(question.explanation) ||
        !['easy', 'medium', 'hard'].includes(String(question.difficulty)) || !Array.isArray(question.options) ||
        question.options.length < 2 || question.options.length > 6 || !question.options.every(option => text(option, 300)) ||
        new Set(question.options.map(normalizeMaterial)).size !== question.options.length ||
        typeof question.correctOptionIndex !== 'number' || !Number.isInteger(question.correctOptionIndex) ||
        question.correctOptionIndex < 0 || question.correctOptionIndex >= question.options.length) return rejected('question_shape');
    if (!hasEvidence(question.evidence)) return rejected('question_evidence');
    const key = normalizeMaterial(question.prompt);
    if (!key || prompts.has(key)) return rejected('duplicate_question');
    prompts.add(key);
  }
  return { status: 'review', issues: ['semantic_review_required'] };
}
