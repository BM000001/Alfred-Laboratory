import { describe, expect, it, vi } from 'vitest';
import { requestAIStudyPack, validateAIStudyPack } from './studyRemotePack';

const origin = 'https://private.example.workers.dev';
const excerpt = 'HTTP é um protocolo usado para transferir informações entre clientes e servidores web.';
const chunks = [{ chunkId: 'trecho-1', text: excerpt }];

describe('remote study pack', () => {
  it('validates questions, lessons and literal flashcards against the material', () => {
    const pack = validateAIStudyPack({
      questions: [{ question: 'Qual protocolo é citado?', answer: 'HTTP', distractors: ['FTP', 'SMTP'], explanation: 'É indicado na fonte.', chunkId: 'trecho-1' }],
      lessons: [{ title: 'HTTP', explanation: 'O protocolo permite transferências.', example: 'Imagine uma conversa digital.', check: 'Qual protocolo?', answer: 'HTTP', chunkId: 'trecho-1' }],
      flashcards: [
        { front: 'Qual protocolo?', back: 'HTTP', chunkId: 'trecho-1' },
        { front: 'Qual invenção?', back: 'Um conceito inventado', chunkId: 'trecho-1' },
      ],
    }, chunks);
    expect(pack.questions).toHaveLength(1);
    expect(pack.lessons).toHaveLength(1);
    expect(pack.lessons[0].example).toContain('Exemplo complementar da IA:');
    expect(pack.lessons[0].sourceExcerpt).toBe(excerpt);
    expect(pack.flashcards).toHaveLength(1);
    expect(pack.flashcards[0].back).toBe('HTTP');
  });

  it('does not call AI unless consent and same origin are confirmed', async () => {
    const fetcher = vi.fn();
    await expect(requestAIStudyPack({
      configuredOrigin: origin, currentOrigin: origin, sourceText: excerpt, consent: false,
      signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch,
    })).rejects.toThrow('Autorize');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses one authorized request to build a full pack', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      questions: [], lessons: [],
      flashcards: [{ front: 'Qual protocolo?', back: 'HTTP', chunkId: 'trecho-1' }],
    }), { status: 200 }));
    const pack = await requestAIStudyPack({
      configuredOrigin: origin, currentOrigin: origin, sourceText: excerpt, consent: true,
      signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch,
    });
    expect(pack.flashcards).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(origin + '/api/studies/prepare');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).consent).toBe(true);
  });

  it('falls back to questions only when an older Worker lacks the pack route', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ questions: [] }), { status: 200 }));
    const pack = await requestAIStudyPack({
      configuredOrigin: origin, currentOrigin: origin, sourceText: excerpt, consent: true,
      signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch,
    });
    expect(pack).toEqual({ questions: [], lessons: [], flashcards: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
