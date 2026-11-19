import { describe, expect, it } from 'vitest';
import { validateStudyEnhancement } from "./studyEnhancementValidation";
import { DisabledStudyEnhancementProvider, type StudyEnhancementRequest } from './studyEnhancementProvider';

const request: StudyEnhancementRequest = {
  version: 1,
  requestId: 'req-1',
  sourceFileId: 'file-1',
  disciplineId: 'disc-1',
  topicId: 'topic-1',
  profile: 'prose',
  task: 'questions',
  chunks: [{ chunkId: 'c1', text: 'A mitose mantém o número de cromossomos.', pageNumber: 1 }],
  consent: { externalProcessing: false, externalAi: false },
};

describe('DisabledStudyEnhancementProvider', () => {
  const provider = new DisabledStudyEnhancementProvider();

  it('returns a deterministic offline fallback without generated resources', async () => {
    const result = await provider.enhance(request);
    expect(result).toMatchObject({
      version: 1, requestId: 'req-1', status: 'needs_ai',
      providerKind: 'rules', flashcards: [], questions: [], evidence: [],
    });
  });

  it('does not invent content from empty material', async () => {
    const result = await provider.enhance({ ...request, chunks: [{ chunkId: 'empty', text: '   ' }] });
    expect(result.status).toBe('insufficient_evidence');
    expect(result.flashcards).toEqual([]);
    expect(result.questions).toEqual([]);
  });

  it('respects an aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(provider.enhance(request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not modify the original request or require external consent', async () => {
    const original = JSON.stringify(request);
    await provider.enhance(request);
    expect(JSON.stringify(request)).toBe(original);
    expect(request.consent).toEqual({ externalProcessing: false, externalAi: false });
  });
});

describe('validação de sugestões externas', () => {
  const excerpt = request.chunks[0].text;
  const context = {
    source: { id: 'file-1', disciplineId: 'disc-1', text: excerpt, pages: [{ pageNumber: 1, text: excerpt }] },
    topic: { id: 'topic-1', disciplineId: 'disc-1', sourceFileId: 'file-1' },
  };
  const question = { prompt: 'O que acontece na mitose?', explanation: excerpt, options: ['Mantém', 'Altera'],
    difficulty: 'easy', correctOptionIndex: 0, evidence: [{ chunkId: 'c1', excerpt }] };
  const result = { version: 1, requestId: 'req-1', status: 'ready', providerKind: 'ai',
    flashcards: [], questions: [question], evidence: [], warnings: [] };

  it('encaminha citações literais para revisão semântica', () => {
    expect(validateStudyEnhancement(request, result, context)).toEqual({ status: 'review', issues: ['semantic_review_required'] });
  });

  it.each([
    [{ ...question, evidence: [] }, 'question_evidence'],
    [{ ...question, evidence: [{ chunkId: 'c1', excerpt: 'Texto inventado' }] }, 'question_evidence'],
    [{ ...question, correctOptionIndex: -1 }, 'question_shape'],
    [{ ...question, options: ['Mantém', 'MANTEM'] }, 'question_shape'],
  ])('rejeita resultado inválido', (entry, reason) => {
    expect(validateStudyEnhancement(request, { ...result, questions: [entry] }, context).issues).toEqual([reason]);
  });

  it('verifica vínculos, páginas e duplicatas existentes e recebidas', () => {
    expect(validateStudyEnhancement(request, result, { ...context, topic: { ...context.topic, disciplineId: 'other' } }).issues).toEqual(['source_scope']);
    expect(validateStudyEnhancement(request, result, { ...context, source: { ...context.source, pages: [] } }).issues).toEqual(['chunk_scope']);
    expect(validateStudyEnhancement(request, result, { ...context, existingPrompts: [question.prompt] }).issues).toEqual(['duplicate_question']);
    const card = { front: 'Mitose', back: 'Mantém os cromossomos', evidence: question.evidence };
    expect(validateStudyEnhancement({ ...request, task: 'flashcards' }, { ...result, questions: [], flashcards: [card, card] }, context).issues)
      .toEqual(['duplicate_flashcard']);
  });
});
