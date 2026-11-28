import { fileRepository, studyTopicRepository, studyFlashcardRepository, studyQuestionRepository } from '../../storage/repositories';
import { extractTextDocument } from '../files/documentExtractor';
import type { StudyTopic } from './types';
import type { StoredTextExtraction } from '../files/types';
import { assessMaterial, correctMaterial, validateMaterialResources, normalizeMaterial, relevantAmbiguities, structureMaterial, type ProcessingProfile, type Correction } from './materialReliability';
import { extractStudyDefinitions } from './studyMaterialGeneration';

export interface MaterialProcessingState {
  version: 1; profile: ProcessingProfile; status: 'running' | 'cancelled' | 'failed' | 'review' | 'awaiting-ai' | 'completed';
  stage: string; topicId?: string; error?: string; raw?: StoredTextExtraction; corrected?: string; corrections?: Correction[];
  assessment?: ReturnType<typeof assessMaterial>; structured?: { blocks?: ReturnType<typeof structureMaterial>; definitions: ReturnType<typeof extractStudyDefinitions>; formulas: string[]; summary: string };
  skipDefinitionReview?: boolean;
  ambiguities?: ReturnType<typeof relevantAmbiguities>;
  /** AI-authored lessons tied to their original excerpt. Optional: no IndexedDB migration. */
  aiLessons?: Array<{ id: string; title: string; explanation: string; example: string; check: string; answer: string; sourceExcerpt: string; createdAt: string }>;
  /** Optional validated response awaiting local persistence. Revalidated against the source on resume. */
  pendingStudyPack?: { version: 1; id: string; payload: unknown };
  generated?: ReturnType<typeof validateMaterialResources>;
}
const active = new Set<string>();
export async function processStoredMaterial(id: string, profile: ProcessingProfile, signal: AbortSignal, progress: (detail: string) => void, sourceFile?: File, unit?: StudyTopic, options: { requireAI?: boolean } = {}) {
  if (active.has(id)) throw new Error('Este arquivo já está em processamento.');
  active.add(id);
  let state: MaterialProcessingState | undefined;
  async function checkpoint(stage: string) {
    state!.stage = stage;
    const latest = await fileRepository.getById(id);
    if (!latest) throw new Error('O arquivo de origem foi removido.');
    await fileRepository.save({ ...latest, processing: state });
    progress(stage);
    signal.throwIfAborted();
  }
  try {
    const stored = await fileRepository.getById(id);
    if (!stored?.disciplineId) throw new Error('Arquivo sem disciplina.');
    state = stored.processing ?? { version: 1, profile, status: 'running', stage: 'Preparando material' };
    if (unit && (unit.disciplineId !== stored.disciplineId || unit.sourceFileId !== id)) {
      state = undefined;
      throw new Error('O arquivo não pertence a esta unidade.');
    }
    const topicId = unit?.id ?? `material:${id}`;
    if (state.topicId && state.topicId !== topicId && state.status !== 'completed') {
      const pendingUnit = await studyTopicRepository.getById(state.topicId);
      if (pendingUnit?.sourceFileId === id && pendingUnit.disciplineId === stored.disciplineId) {
        state = undefined;
        throw new Error('Retome primeiro o processamento na unidade em que ele foi iniciado.');
      }
    }
    state.topicId = topicId;
    let cardsAdded = 0;
    let questionsAdded = 0;
    profile = state.profile; state.status = 'running'; delete state.error;
    await checkpoint('Preparando material');
    if (!state.raw) {
      const file = sourceFile ?? new File([stored.blob], stored.name, { type: stored.type });
      state.raw = stored.extraction ?? await extractTextDocument(file, () => new Date(), p => progress(`${p.status} · ${Math.round(p.progress * 100)}%`), { profile, signal });
      await checkpoint('Texto bruto reconhecido');
    }
    if (state.corrected === undefined) {
      const result = correctMaterial(state.raw.text, id, profile);
      state.corrected = result.corrected; state.corrections = result.corrections;
      await checkpoint('Texto corrigido com rastreabilidade');
    }
    const ambiguities = relevantAmbiguities(state.corrected);
    if (!state.assessment || (!state.generated && state.assessment.conflicts !== Boolean(ambiguities.length))) {
      const ocrPages = state.raw.pages?.filter(page => page.method === 'ocr') ?? [];
      const ocrConfidence = state.raw.confidence ?? (ocrPages.length ? Math.min(...ocrPages.map(page => page.confidence ?? 0)) : state.raw.extractionMethod === 'ocr' || state.raw.format === 'image' ? 0 : undefined);
      state.assessment = assessMaterial(state.corrected, ocrConfidence, state.raw.imageQuality);
      await checkpoint('Consistência e confiança avaliadas');
    }
    state.ambiguities = ambiguities;
    if (state.ambiguities.length && !state.skipDefinitionReview) {
      state.status = 'review';
      await checkpoint('Uma definição conflitante precisa de confirmação');
      return { state, cardsAdded, questionsAdded };
    }
    if (!state.structured) {
      const definitions = extractStudyDefinitions(state.corrected);
      const blocks = structureMaterial(state.corrected);
      const summary = [...new Set([
        ...definitions.map(entry => entry.sourceExcerpt),
        ...blocks.filter(block => block.kind !== 'title').map(block => block.text),
      ])].filter(excerpt => excerpt.length <= 500 && state!.raw!.text.includes(excerpt)).slice(0, 5).join('\n');
      state.structured = { blocks, definitions, formulas: state.corrected.split('\n').filter(line => /[=∑∫√]/u.test(line)), summary };
      await checkpoint('Conteúdo estruturado e resumo extraído');
    }
    // For the interactive importer, do not synthesize quizzes with deterministic local rules.
    // Preserve extraction and provenance until a genuine AI provider is available.
    if (options.requireAI) {
      await checkpoint('Material estruturado. Aguardando geração por IA.');
      state.status = 'awaiting-ai';
      const latest = await fileRepository.getById(id);
      if (!latest) throw new Error('Arquivo removido durante processamento.');
      await fileRepository.save({ ...latest, extraction: state.raw, processing: state });
      return { state, cardsAdded, questionsAdded, awaitingAI: true };
    }
    if (!state.generated) {
      state.generated = validateMaterialResources(state.corrected, state.assessment.score, profile, state.raw.text);
      await checkpoint('Flashcards e questões validados');
    }
    // Stable IDs make recovery idempotent even if the page closes during saving.
    if (!await studyTopicRepository.getById(topicId)) await studyTopicRepository.save({ id: topicId, disciplineId: stored.disciplineId, title: stored.name, status: 'pending', createdAt: new Date().toISOString(), sourceFileId: id, sourceFileName: stored.name, notes: state.structured.summary });
    if (unit) {
      const linked = await studyTopicRepository.getById(unit.id);
      if (linked?.sourceFileId !== id || linked.disciplineId !== stored.disciplineId) throw new Error('O vínculo com a unidade mudou.');
    }
    const [cards, questions] = await Promise.all([studyFlashcardRepository.getAll(), studyQuestionRepository.getAll()]);
    const cardIds = new Set(cards.map((card) => card.id));
    const questionIds = new Set(questions.map((question) => question.id));
    const cardKeys = new Set(cards.filter(c => c.disciplineId === stored.disciplineId && c.topicId === topicId).map(c => normalizeMaterial(c.front) + '|' + normalizeMaterial(c.back)));
    const questionKeys = new Set(questions.filter(q => q.disciplineId === stored.disciplineId && q.topicId === topicId).map(q => normalizeMaterial(q.prompt)));
    const definitionExcerpts = new Set(extractStudyDefinitions(state.corrected).map(entry => entry.sourceExcerpt));
    const priorDefinitions = (items: typeof cards | typeof questions) => new Set(items.filter(item =>
      item.disciplineId === stored.disciplineId && item.topicId === topicId && item.sourceFileId === id &&
      item.sourceExcerpt && definitionExcerpts.has(item.sourceExcerpt)).map(item => item.sourceExcerpt));
    const priorCardDefinitions = priorDefinitions(cards);
    const priorQuestionDefinitions = priorDefinitions(questions);
    const timestamp = new Date().toISOString();
    for (const [index, card] of state.generated.flashcards.entries()) {
      signal.throwIfAborted();
      const key = normalizeMaterial(card.front) + '|' + normalizeMaterial(card.back);
      const cardId = `${topicId}:material:${id}:card:${index}`;
      if (cardIds.has(cardId) || cardKeys.has(key) || priorCardDefinitions.has(card.sourceExcerpt)) continue;
      await studyFlashcardRepository.save({ ...card, id: cardId, disciplineId: stored.disciplineId, topicId, sourceFileId: id, sourceFileName: stored.name, createdAt: timestamp, nextReviewAt: timestamp, intervalDays: 0, reviewCount: 0 });
      cardKeys.add(key); cardsAdded++;
    }
    for (const [index, question] of state.generated.questions.entries()) {
      signal.throwIfAborted();
      const key = normalizeMaterial(question.prompt);
      const questionId = `${topicId}:material:${id}:question:${index}`;
      if (questionIds.has(questionId) || questionKeys.has(key) || priorQuestionDefinitions.has(question.sourceExcerpt)) continue;
      await studyQuestionRepository.save({ ...question, id: questionId, disciplineId: stored.disciplineId, topicId, sourceFileId: id, sourceFileName: stored.name, createdAt: timestamp });
      questionKeys.add(key); questionsAdded++;
    }
    await checkpoint('Resultados salvos');
    state.status = 'completed';
    const latest = await fileRepository.getById(id);
    if (!latest) throw new Error('Arquivo removido durante processamento.');
    await fileRepository.save({ ...latest, extraction: state.raw, processing: state });
    return { state, cardsAdded, questionsAdded };
  } catch (error) {
    if (state) {
      state.status = signal.aborted ? 'cancelled' : 'failed'; state.error = error instanceof Error ? error.message : String(error);
      const latest = await fileRepository.getById(id);
      if (latest) await fileRepository.save({ ...latest, processing: state });
    }
    throw error;
  } finally { active.delete(id); }
}

/** Confirm only the conflicting excerpt; original OCR remains immutable. */
export async function confirmMaterialDefinition(id: string, sourceExcerpt: string | null) {
  const file = await fileRepository.getById(id);
  const state = file?.processing;
  if (active.has(id)) throw new Error('Aguarde o processamento deste material.');
  if (!file || !state?.raw || !state.corrected || state.status !== 'review') throw new Error('Não existe confirmação pendente para este arquivo.');
  if (sourceExcerpt === null) {
    await fileRepository.save({ ...file, processing: { ...state, skipDefinitionReview: true, status: 'cancelled',
      generated: undefined, stage: 'Fontes preservadas; pronto para retomar' } });
    return;
  }
  const group = relevantAmbiguities(state.corrected).find(entries => entries.some(entry => entry.sourceExcerpt === sourceExcerpt));
  if (!group) throw new Error('A opção não pertence ao trecho de origem.');
  const removed = group.filter(entry => entry.sourceExcerpt !== sourceExcerpt);
  let corrected = state.corrected;
  const corrections = [...(state.corrections ?? [])];
  for (const entry of removed) {
    const start = state.raw.text.indexOf(entry.sourceExcerpt);
    corrected = corrected.replace(entry.sourceExcerpt, '');
    corrections.push({ original: start >= 0 ? entry.sourceExcerpt : state.raw.text, corrected: start >= 0 ? '' : corrected, reason: 'Definição conflitante descartada após confirmação explícita do usuário', confidence: 100, sourceFileId: id, region: { start: Math.max(0, start), end: start >= 0 ? start + entry.sourceExcerpt.length : state.raw.text.length } });
  }
  await fileRepository.save({ ...file, processing: { ...state, corrected, corrections, assessment: undefined, structured: undefined, generated: undefined, ambiguities: undefined, status: 'cancelled', stage: 'Trecho confirmado; pronto para retomar' } });
}
