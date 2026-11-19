import { describe, expect, it } from 'vitest';
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
