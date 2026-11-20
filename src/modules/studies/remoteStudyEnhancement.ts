import type { StudyEnhancementProvider, StudyEnhancementRequest, StudyEnhancementResult } from './studyEnhancementProvider';

export class RemoteStudyEnhancementProvider implements StudyEnhancementProvider {
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}

  async enhance(request: StudyEnhancementRequest, signal?: AbortSignal): Promise<StudyEnhancementResult> {
    signal?.throwIfAborted();
    if (request.task !== 'questions' || !request.consent.externalAi || !request.consent.externalProcessing) {
      throw new Error('Autorize o envio dos trechos e o processamento por IA.');
    }
    const timeout = AbortSignal.timeout(90_000);
    let response: Response;
    try {
      response = await this.fetcher('/api/studies/questions', {
        method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        body: JSON.stringify({ consent: true, chunks: request.chunks.map(({ chunkId, text }) => ({ chunkId, text })) }),
      });
    } catch {
      signal?.throwIfAborted();
      throw new Error(timeout.aborted ? 'A geração demorou mais que o esperado. Tente novamente mais tarde.' :
        'Sem conexão com a prévia. As questões salvas continuam disponíveis.');
    }
    signal?.throwIfAborted();
    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
      throw new Error('Acesso à prévia expirado ou conta sem autorização. Reabra a prévia no Safari.');
    }
    if (response.status === 429) {
      const wait = Number(response.headers.get('Retry-After'));
      throw new Error(wait > 0 && wait <= 86400
        ? `Limite de geração atingido. Tente novamente em cerca de ${Math.ceil(wait / 60)} min.`
        : 'Limite de geração atingido. Tente novamente mais tarde.');
    }
    if (response.status === 502) throw new Error('A IA devolveu uma resposta inválida.');
    if (!response.ok) throw new Error('A geração remota está indisponível.');
    let body;
    try { body = await response.json(); } catch { signal?.throwIfAborted(); }
    signal?.throwIfAborted();
    if (!body || Object.keys(body).length !== 1 || !Array.isArray(body.questions) || body.questions.length > 3 ||
        body.questions.some((item: unknown) => !item || typeof item !== 'object' || Object.keys(item).length !== 5 ||
          !('question' in item) || typeof item.question !== 'string' || !('answer' in item) || typeof item.answer !== 'string' ||
          !('chunkId' in item) || typeof item.chunkId !== 'string' || !('explanation' in item) || typeof item.explanation !== 'string' ||
          !('distractors' in item) || !Array.isArray(item.distractors) || item.distractors.length !== 2 ||
          item.distractors.some(option => typeof option !== 'string'))) {
      throw new Error('A IA devolveu uma resposta inválida.');
    }
    const questions = body.questions.map((item: { question: string; answer: string; distractors: string[]; explanation: string; chunkId: string }, index: number) => {
      const correctOptionIndex = (index + 1) % 3;
      const options = [...item.distractors];
      options.splice(correctOptionIndex, 0, item.answer);
      const excerpt = request.chunks.find(chunk => chunk.chunkId === item.chunkId)?.text ?? '';
      return { prompt: item.question, options, correctOptionIndex, explanation: item.explanation,
        difficulty: 'medium' as const, evidence: [{ chunkId: item.chunkId, excerpt }] };
    });
    return { version: 1, requestId: request.requestId, status: questions.length ? 'ready' : 'insufficient_evidence',
      providerKind: 'ai', questions, flashcards: [], evidence: [], warnings: [] };
  }
}
