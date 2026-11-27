/**
 * Private, same-origin Cloudflare Access adapter for the Studies AI experiment.
 *
 * The GitHub Pages Laboratory MUST NOT call the protected Worker cross-origin:
 * Safari may block third-party Access cookies, and no service token belongs in JS.
 * The adapter stays disabled unless a protected app is served from the exact
 * HTTPS origin configured at build time.
 */
import type { StudyQuestionDifficulty } from './questionTypes';

export type StudySourceChunk = { chunkId: string; text: string };
export type ValidatedAIStudyQuestion = {
  prompt: string;
  options: [string, string, string];
  correctOptionIndex: number;
  explanation: string;
  sourceExcerpt: string;
  difficulty: StudyQuestionDifficulty;
  subject: string;
};

type RequestAIQuestions = {
  configuredOrigin: string | undefined;
  currentOrigin: string;
  sourceText: string;
  consent: boolean;
  signal: AbortSignal;
  fetcher?: typeof fetch;
};

export function isSameOriginAIAvailable(configuredOrigin: string | undefined, currentOrigin: string): boolean {
  if (!configuredOrigin) return false;
  try {
    const configured = new URL(configuredOrigin);
    const current = new URL(currentOrigin);
    return configured.protocol === 'https:' && current.protocol === 'https:'
      && configured.origin === current.origin && configured.pathname === '/'
      && !configured.search && !configured.hash;
  } catch {
    return false;
  }
}

/** Select at most three direct excerpts from the original source, without synthesis. */
export function selectAIStudyChunks(sourceText: string): StudySourceChunk[] {
  const excerpts = sourceText.split(/\r?\n/u).map(line => line.trim()).filter(line => line.length >= 40);
  const candidates = excerpts.length ? excerpts : [sourceText.trim()];
  const seen = new Set<string>();
  const selected: StudySourceChunk[] = [];
  for (const original of candidates) {
    const text = original.slice(0, 1200);
    if (text.trim().length < 40 || seen.has(text)) continue;
    seen.add(text);
    selected.push({ chunkId: 'trecho-' + (selected.length + 1), text });
    if (selected.length >= 3) break;
  }
  return selected;
}

function normalizeEvidence(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('pt-BR');
}

export function validateAIStudyQuestions(payload: unknown, chunks: StudySourceChunk[]): ValidatedAIStudyQuestion[] {
  if (!payload || typeof payload !== 'object' || !('questions' in payload)) throw new Error('Resposta inválida da IA.');
  const questions = (payload as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length > 3) throw new Error('Quantidade inválida de questões da IA.');
  const sources = new Map(chunks.map(chunk => [chunk.chunkId, chunk.text]));
  const accepted: ValidatedAIStudyQuestion[] = [];
  const prompts = new Set<string>();
  for (const candidate of questions) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    const { question, answer, distractors, explanation, chunkId } = item;
    if (typeof question !== 'string' || !question.trim() || question.length > 500 ||
        typeof answer !== 'string' || !answer.trim() || answer.length > 300 ||
        typeof explanation !== 'string' || !explanation.trim() || explanation.length > 2000 ||
        typeof chunkId !== 'string' || !Array.isArray(distractors) ||
        distractors.length !== 2 || distractors.some(option => typeof option !== 'string' || !option.trim() || option.length > 300)) continue;
    const excerpt = sources.get(chunkId);
    if (!excerpt || !normalizeEvidence(excerpt).includes(normalizeEvidence(answer))) continue;
    const options = [answer, ...distractors] as [string, string, string];
    if (new Set(options.map(normalizeEvidence)).size !== 3) continue;
    const normalizedPrompt = normalizeEvidence(question);
    if (prompts.has(normalizedPrompt)) continue;
    prompts.add(normalizedPrompt);
    const index = accepted.length % 3;
    [options[0], options[index]] = [options[index], options[0]];
    accepted.push({
      prompt: question.trim(),
      options,
      correctOptionIndex: index,
      // Always distinguish unmodified evidence from the AI-authored explanation.
      explanation: 'Trecho de origem: ' + excerpt + '\nExplicação gerada por IA: ' + explanation.trim(),
      sourceExcerpt: excerpt,
      difficulty: 'medium',
      subject: 'Questão fundamentada no material',
    });
  }
  return accepted;
}

export async function postPrivateStudyRequest(
  url: string, chunks: StudySourceChunk[], signal: AbortSignal, fetcher: typeof fetch,
) {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent: true, chunks,
        generation: { count: 3, difficulty: 'medium', goal: 'recordar', kind: 'conceitual' },
      }),
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error('Sem conexão com a prévia de IA. O material continua neste dispositivo.');
  }
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400) ||
      response.status === 401 || response.status === 403) {
    throw new Error('O Cloudflare Access requer uma sessão válida. Entre na prévia com a conta permitida.');
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const wait = retryAfter && /^\d{1,6}$/.test(retryAfter) ? ' Aguarde ' + retryAfter + ' s.' : ' Tente mais tarde.';
    throw new Error('Limite temporário da IA atingido.' + wait);
  }
  return response;
}

export async function requestAIStudyQuestions({
  configuredOrigin, currentOrigin, sourceText, consent, signal, fetcher = fetch,
}: RequestAIQuestions): Promise<ValidatedAIStudyQuestion[]> {
  if (!consent) throw new Error('Autorize o envio de trechos do material antes de usar a IA.');
  if (!isSameOriginAIAvailable(configuredOrigin, currentOrigin)) {
    throw new Error('Geração por IA indisponível nesta origem. Abra uma prévia HTTPS autenticada.');
  }
  const chunks = selectAIStudyChunks(sourceText);
  if (!chunks.length) throw new Error('O material não contém trechos suficientes para elaborar questões com segurança.');
  const response = await postPrivateStudyRequest(currentOrigin + '/api/studies/questions', chunks, signal, fetcher);
  if (!response.ok) throw new Error('A IA não conseguiu preparar as questões agora. O material foi preservado.');
  const payload: unknown = await response.json();
  return validateAIStudyQuestions(payload, chunks);
}
