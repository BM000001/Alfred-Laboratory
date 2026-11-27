import {
  isSameOriginAIAvailable, postPrivateStudyRequest, requestAIStudyQuestions, selectAIStudyChunks, validateAIStudyQuestions,
  type StudySourceChunk, type ValidatedAIStudyQuestion,
} from './studyRemoteQuestions';

export type ValidatedAIStudyLesson = {
  title: string;
  explanation: string;
  example: string;
  check: string;
  answer: string;
  sourceExcerpt: string;
};
export type ValidatedAIStudyFlashcard = { front: string; back: string; sourceExcerpt: string };
export type ValidatedAIStudyPack = {
  questions: ValidatedAIStudyQuestion[];
  lessons: ValidatedAIStudyLesson[];
  flashcards: ValidatedAIStudyFlashcard[];
};

function bounded(value: unknown, max: number): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= max;
}
function literalEvidence(source: string, answer: string): boolean {
  const normalize = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR').trim();
  return normalize(source).includes(normalize(answer));
}

/** Untrusted model output is validated against the exact excerpts sent to the Worker. */
export function validateAIStudyPack(payload: unknown, chunks: StudySourceChunk[]): ValidatedAIStudyPack {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Pacote inválido da IA.');
  const value = payload as Record<string, unknown>;
  if (!Array.isArray(value.questions) || !Array.isArray(value.lessons) || !Array.isArray(value.flashcards) ||
      value.questions.length > 3 || value.lessons.length > 3 || value.flashcards.length > 3) {
    throw new Error('Pacote da IA não corresponde ao contrato de estudos.');
  }
  const questions = validateAIStudyQuestions({ questions: value.questions }, chunks);
  const sources = new Map(chunks.map(chunk => [chunk.chunkId, chunk.text]));
  const lessons: ValidatedAIStudyLesson[] = [];
  const lessonTitles = new Set<string>();
  for (const raw of value.lessons) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (!bounded(item.title, 120) || !bounded(item.explanation, 1800) ||
        !bounded(item.example, 1000) || !bounded(item.check, 300) ||
        !bounded(item.answer, 300) || !bounded(item.chunkId, 16)) continue;
    const excerpt = sources.get(item.chunkId);
    if (!excerpt || !literalEvidence(excerpt, item.answer)) continue;
    const titleKey = item.title.toLocaleLowerCase('pt-BR').trim();
    if (lessonTitles.has(titleKey)) continue;
    lessonTitles.add(titleKey);
    lessons.push({
      title: item.title.trim(), explanation: item.explanation.trim(),
      example: item.example.startsWith('Exemplo da IA:')
        ? item.example.trim() : 'Exemplo complementar da IA: ' + item.example.trim(),
      check: item.check.trim(), answer: item.answer.trim(), sourceExcerpt: excerpt,
    });
  }
  const flashcards: ValidatedAIStudyFlashcard[] = [];
  const fronts = new Set<string>();
  for (const raw of value.flashcards) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (!bounded(item.front, 300) || !bounded(item.back, 500) || !bounded(item.chunkId, 16)) continue;
    const excerpt = sources.get(item.chunkId);
    if (!excerpt || !literalEvidence(excerpt, item.back)) continue;
    const frontKey = item.front.toLocaleLowerCase('pt-BR').trim();
    if (fronts.has(frontKey)) continue;
    fronts.add(frontKey);
    flashcards.push({ front: item.front.trim(), back: item.back.trim(), sourceExcerpt: excerpt });
  }
  return { questions, lessons, flashcards };
}

export async function requestAIStudyPack(args: {
  configuredOrigin: string | undefined;
  currentOrigin: string;
  sourceText: string;
  consent: boolean;
  signal: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<ValidatedAIStudyPack> {
  const { configuredOrigin, currentOrigin, sourceText, consent, signal, fetcher = fetch } = args;
  if (!consent) throw new Error('Autorize o envio dos trechos do material à IA.');
  if (!isSameOriginAIAvailable(configuredOrigin, currentOrigin)) {
    throw new Error('IA indisponível fora da prévia HTTPS autenticada.');
  }
  const chunks = selectAIStudyChunks(sourceText);
  if (!chunks.length) throw new Error('Material insuficiente para gerar conteúdos com IA.');
  const response = await postPrivateStudyRequest(currentOrigin + '/api/studies/prepare', chunks, signal, fetcher);
  // Older private Worker versions only expose the questions endpoint.
  if (response.status === 404) {
    const questions = await requestAIStudyQuestions(args);
    return { questions, lessons: [], flashcards: [] };
  }
  if (!response.ok) throw new Error('A IA não conseguiu preparar as atividades. O original continua salvo.');
  const data: unknown = await response.json();
  return validateAIStudyPack(data, chunks);
}
