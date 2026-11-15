import { fileRepository, egressAuditRepository, egressSettingsRepository } from '../../storage/repositories';
import { createEgressAuditEntry } from '../assistant/egressAudit';
import { extractStudyDefinitions } from '../studies/studyMaterialGeneration';
import { structureMaterial, validateMaterialResources } from '../studies/materialReliability';
import type { AITask, AIResult, RemoteExecution } from './contracts';
import { buildStudyPrompt, PROMPT_VERSION } from './prompts';

export function analyzeText(text: string, requiresReview = false, uncertainties: string[] = []) {
  const definitions = extractStudyDefinitions(text);
  return { text, definitions, formulas: structureMaterial(text).filter(block => block.kind === 'formula').map(block => block.text), summary: definitions.slice(0, 5).map(entry => entry.sourceExcerpt).join('\n'), uncertainties, requiresReview };
}
export function localExecution(task: AITask): AIResult {
  return task.operation === 'studies.analyze'
    ? { analysis: analyzeText(task.input.text) }
    : { resources: validateMaterialResources(task.input.text, task.input.confidence, task.input.profile) };
}
export function validateEndpoint(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('Use uma URL sem credenciais, parâmetros ou fragmentos.');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('A Central precisa de HTTPS; HTTP é permitido somente em localhost.');
  return url.toString().replace(/\/$/, '');
}
function imageData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Falha ao preparar imagem.')); reader.onerror = () => reject(new Error('Falha ao ler imagem.')); reader.readAsDataURL(blob); });
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validateRemoteResult(task: AITask, value: unknown): AIResult {
  if (!record(value)) throw new Error('Resposta da Central inválida.');
  if (task.operation === 'studies.analyze') {
    if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 200_000 || !Array.isArray(value.uncertainties) || value.uncertainties.length > 100 || value.uncertainties.some(item => typeof item !== 'string' || item.length > 1000)) throw new Error('A análise não contém transcrição e incertezas válidas.');
    // A VLM transcription is a proposal, not new trusted evidence for generation.
    return { analysis: analyzeText(value.text, true, value.uncertainties as string[]) };
  }
  if (!Array.isArray(value.flashcards) || !Array.isArray(value.questions) || value.flashcards.length > 100 || value.questions.length > 100) throw new Error('Formato de recursos inválido.');
  // First release admits only resources independently supported by the existing
  // deterministic generator. Novel paraphrases remain proposals, never trusted saves.
  const offeredCards = value.flashcards, offeredQuestions = value.questions;
  const trusted = validateMaterialResources(task.input.text, task.input.confidence, task.input.profile);
  const flashcards = trusted.flashcards.filter(card => offeredCards.some((candidate: unknown) => record(candidate) && candidate.front === card.front && candidate.back === card.back && candidate.sourceExcerpt === card.sourceExcerpt));
  const questions = trusted.questions.filter(question => offeredQuestions.some((candidate: unknown) => record(candidate) && candidate.prompt === question.prompt && candidate.explanation === question.explanation && candidate.sourceExcerpt === question.sourceExcerpt && candidate.correctOptionIndex === question.correctOptionIndex && JSON.stringify(candidate.options) === JSON.stringify(question.options)));
  const total = value.flashcards.length + value.questions.length;
  return { resources: { flashcards, questions, rejected: total - flashcards.length - questions.length, validity: total ? Math.round((flashcards.length + questions.length) / total * 100) : 0 } };
}
export async function remoteExecution(task: AITask, remote: RemoteExecution, signal: AbortSignal): Promise<AIResult> {
  const endpoint = validateEndpoint(remote.endpoint);
  if (remote.consent.taskId !== task.id || remote.consent.endpoint !== endpoint || remote.consent.includeImage !== !!task.input.includeImage || !remote.token.trim()) throw new Error('Revise e autorize este envio para a Central configurada.');
  if (task.input.connection && (task.input.connection.endpoint !== endpoint || !remote.freeTierConsent)) throw new Error('Confirme o destino e a cota gratuita desta conexão.');
  if ((await egressSettingsRepository.getById('global'))?.enabled === false) throw new Error('O envio externo está desativado nas configurações de privacidade.');
  const file = await fileRepository.getById(task.input.sourceFileId);
  if (!file || file.disciplineId !== task.input.disciplineId) throw new Error('Arquivo de origem indisponível ou movido para outra disciplina.');
  if (remote.consent.includeImage && (task.operation !== 'studies.analyze' || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024)) throw new Error('Envie uma imagem JPG, PNG ou WebP de até 8 MB para análise.');
  const image = remote.consent.includeImage ? await imageData(file.blob) : undefined;
  signal.throwIfAborted();
  await egressAuditRepository.save(createEgressAuditEntry({ classes: ['academic'], itemCount: 1, characterCount: task.input.text.length, action: 'sent_to_ai' }));
  // Recover a server-completed task before uploading the photo again after interruption.
  let response: Response | undefined;
  if (task.attempts > 1 && task.input.connection) {
    response = await fetch(`${endpoint}/v1/tasks/${encodeURIComponent(task.id)}`, { headers: { Authorization: `Bearer ${remote.token}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), redirect: 'error' });
    if (response.status === 404) response = undefined;
  }
  if (!response) {
  response = await fetch(`${endpoint}/v1/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${remote.token}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]), redirect: 'error', body: JSON.stringify({ version: 1, id: task.id, operation: task.operation, sourceFileId: task.input.sourceFileId, promptVersion: PROMPT_VERSION, instruction: buildStudyPrompt(task.operation), text: task.input.text, ...(task.input.connection ? { connectionId: task.input.connection.id, connectionRevision: task.input.connection.revision, freeTierConsent: remote.freeTierConsent === true } : {}), ...(image ? { image } : {}) }) });
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    throw new Error(record(failure) && record(failure.error) && typeof failure.error.message === 'string' ? failure.error.message.slice(0, 500) : `A Central recusou a tarefa (HTTP ${response.status}).`);
  }
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error('A resposta da Central excedeu o limite.');
  const envelope: unknown = JSON.parse(text);
  if (!record(envelope) || envelope.id !== task.id || envelope.version !== 1) throw new Error('Resposta não corresponde à tarefa enviada.');
  if (task.input.connection && (envelope.connectionId !== task.input.connection.id || envelope.connectionRevision !== task.input.connection.revision || envelope.model !== task.input.connection.model || envelope.provider !== task.input.connection.provider)) throw new Error('Resposta pertence a outra conexão ou modelo.');
  const result = validateRemoteResult(task, envelope.result);
  result.execution = { provider: 'gateway', endpoint, promptVersion: PROMPT_VERSION, ...(typeof envelope.model === 'string' && envelope.model.length <= 256 ? { model: envelope.model } : {}) };
  if (record(envelope.usage) && Number.isSafeInteger(envelope.usage.inputTokens) && Number.isSafeInteger(envelope.usage.outputTokens) && Number(envelope.usage.inputTokens) >= 0 && Number(envelope.usage.outputTokens) >= 0) result.usage = { inputTokens: Number(envelope.usage.inputTokens), outputTokens: Number(envelope.usage.outputTokens) };
  return result;
}
