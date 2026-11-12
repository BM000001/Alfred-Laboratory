import { fileRepository, studyTopicRepository, studyFlashcardRepository, studyQuestionRepository } from '../../storage/repositories';
import { extractTextDocument } from '../files/documentExtractor';
import type { StoredTextExtraction } from '../files/types';
import { assessMaterial, correctMaterial, validateMaterialResources, normalizeMaterial, relevantAmbiguities, structureMaterial, type ProcessingProfile, type Correction } from './materialReliability';
import { extractStudyDefinitions } from './studyMaterialGeneration';

export interface MaterialProcessingState {
  version: 1; profile: ProcessingProfile; status: 'running' | 'cancelled' | 'failed' | 'review' | 'completed';
  stage: string; error?: string; raw?: StoredTextExtraction; corrected?: string; corrections?: Correction[];
  assessment?: ReturnType<typeof assessMaterial>; structured?: { blocks?: ReturnType<typeof structureMaterial>; definitions: ReturnType<typeof extractStudyDefinitions>; formulas: string[]; summary: string };
  ambiguities?: ReturnType<typeof relevantAmbiguities>;
  generated?: ReturnType<typeof validateMaterialResources>;
}
const active = new Set<string>();
export async function processStoredMaterial(id: string, profile: ProcessingProfile, signal: AbortSignal, progress: (detail: string) => void, sourceFile?: File) {
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
    if (state.status === 'completed') return state;
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
    if (!state.assessment) {
      const ocrPages = state.raw.pages?.filter(page => page.method === 'ocr') ?? [];
      const ocrConfidence = state.raw.confidence ?? (ocrPages.length ? Math.min(...ocrPages.map(page => page.confidence ?? 0)) : state.raw.extractionMethod === 'ocr' || state.raw.format === 'image' ? 0 : undefined);
      state.assessment = assessMaterial(state.corrected, ocrConfidence, state.raw.imageQuality);
      await checkpoint('Consistência e confiança avaliadas');
    }
    state.ambiguities = relevantAmbiguities(state.corrected);
    if (state.ambiguities.length) {
      state.status = 'review';
      await checkpoint('Uma definição conflitante precisa de confirmação');
      return state;
    }
    if (!state.structured) {
      const definitions = extractStudyDefinitions(state.corrected);
      state.structured = { blocks: structureMaterial(state.corrected), definitions, formulas: state.corrected.split('\n').filter(line => /[=∑∫√]/u.test(line)), summary: definitions.slice(0, 5).map(entry => entry.sourceExcerpt).join('\n') };
      await checkpoint('Conteúdo estruturado e resumo extraído');
    }
    if (!state.generated) {
      state.generated = validateMaterialResources(state.corrected, state.assessment.score, profile);
      // Resource validity can lower confidence, never increase source confidence.
      const combined = Math.min(state.assessment.score, Math.round(state.assessment.score * .9 + state.generated.validity * .1));
      state.assessment.score = combined;
      state.generated = validateMaterialResources(state.corrected, combined, profile);
      await checkpoint('Flashcards e questões validados');
    }
    // Stable IDs make recovery idempotent even if the page closes during saving.
    const topicId = `material:${id}`;
    if (!await studyTopicRepository.getById(topicId)) await studyTopicRepository.save({ id: topicId, disciplineId: stored.disciplineId, title: stored.name, status: 'pending', createdAt: new Date().toISOString(), sourceFileId: id, sourceFileName: stored.name, notes: state.structured.summary });
    const cards = await studyFlashcardRepository.getAll(), questions = await studyQuestionRepository.getAll();
    const cardKeys = new Set(cards.filter(c => c.disciplineId === stored.disciplineId).map(c => normalizeMaterial(c.front) + '|' + normalizeMaterial(c.back)));
    const questionKeys = new Set(questions.filter(q => q.disciplineId === stored.disciplineId).map(q => normalizeMaterial(q.prompt)));
    const timestamp = new Date().toISOString();
    for (const [index, card] of state.generated.flashcards.entries()) {
      signal.throwIfAborted();
      const key = normalizeMaterial(card.front) + '|' + normalizeMaterial(card.back);
      if (cardKeys.has(key)) continue;
      await studyFlashcardRepository.save({ ...card, id: `${topicId}:card:${index}`, disciplineId: stored.disciplineId, topicId, sourceFileId: id, sourceFileName: stored.name, createdAt: timestamp, nextReviewAt: timestamp, intervalDays: 0, reviewCount: 0 });
      cardKeys.add(key);
    }
    for (const [index, question] of state.generated.questions.entries()) {
      signal.throwIfAborted();
      const key = normalizeMaterial(question.prompt);
      if (questionKeys.has(key)) continue;
      await studyQuestionRepository.save({ ...question, id: `${topicId}:question:${index}`, disciplineId: stored.disciplineId, topicId, sourceFileId: id, sourceFileName: stored.name, createdAt: timestamp });
      questionKeys.add(key);
    }
    await checkpoint('Resultados salvos');
    state.status = 'completed';
    const latest = await fileRepository.getById(id);
    if (!latest) throw new Error('Arquivo removido durante processamento.');
    await fileRepository.save({ ...latest, extraction: state.raw, processing: state });
    return state;
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
export async function confirmMaterialDefinition(id: string, sourceExcerpt: string) {
  const file = await fileRepository.getById(id);
  const state = file?.processing;
  if (!file || !state?.corrected || state.status !== 'review') throw new Error('Não existe confirmação pendente para este arquivo.');
  const group = relevantAmbiguities(state.corrected).find(entries => entries.some(entry => entry.sourceExcerpt === sourceExcerpt));
  if (!group) throw new Error('A opção não pertence ao trecho de origem.');
  const removed = group.filter(entry => entry.sourceExcerpt !== sourceExcerpt);
  let corrected = state.corrected;
  const corrections = [...(state.corrections ?? [])];
  for (const entry of removed) {
    const start = state.raw!.text.indexOf(entry.sourceExcerpt);
    corrected = corrected.replace(entry.sourceExcerpt, '');
    corrections.push({ original: start >= 0 ? entry.sourceExcerpt : state.raw!.text, corrected: start >= 0 ? '' : corrected, reason: 'Definição conflitante descartada após confirmação explícita do usuário', confidence: 100, sourceFileId: id, region: { start: Math.max(0, start), end: start >= 0 ? start + entry.sourceExcerpt.length : state.raw!.text.length } });
  }
  await fileRepository.save({ ...file, processing: { ...state, corrected, corrections, assessment: undefined, structured: undefined, generated: undefined, ambiguities: undefined, status: 'cancelled', stage: 'Trecho confirmado; pronto para retomar' } });
}
