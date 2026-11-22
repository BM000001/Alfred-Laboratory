import { describe, expect, it, vi } from 'vitest';
import { isSameOriginAIAvailable, requestAIStudyQuestions, selectAIStudyChunks } from './studyRemoteQuestions';

const origin = 'https://alfred-studies-iphone-preview.example.workers.dev';
const text = 'HTTP é um protocolo de transferência de informações entre clientes e servidores web.';

describe('AI questions private adapter', () => {
  it('only allows a configured HTTPS same-origin host', () => {
    expect(isSameOriginAIAvailable(origin, origin)).toBe(true);
    expect(isSameOriginAIAvailable(undefined, origin)).toBe(false);
    expect(isSameOriginAIAvailable(origin, 'https://bm000001.github.io')).toBe(false);
    expect(isSameOriginAIAvailable('http://example.com', 'http://example.com')).toBe(false);
    expect(isSameOriginAIAvailable(origin + '/api', origin)).toBe(false);
  });

  it('passes only real bounded material excerpts', () => {
    const chunks = selectAIStudyChunks([text, text, 'Título', 'HTTPS usa criptografia para proteger o trânsito de dados nas conexões entre cliente e servidor.'].join('\n'));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ chunkId: 'trecho-1', text });
  });

  it('never sends information without explicit consent or a compatible origin', async () => {
    const fetcher = vi.fn();
    const args = { configuredOrigin: origin, currentOrigin: origin, sourceText: text, consent: false, signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch };
    await expect(requestAIStudyQuestions(args)).rejects.toThrow('Autorize');
    await expect(requestAIStudyQuestions({ ...args, consent: true, currentOrigin: 'https://bm000001.github.io' })).rejects.toThrow('indisponível');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates source-linked answers, provenance and options before exposing questions', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ questions: [
      { question: 'Qual protocolo é descrito?', answer: 'HTTP', distractors: ['SSH', 'SMTP'], explanation: 'HTTP atende à função indicada.', chunkId: 'trecho-1' },
      { question: 'Afirmação inventada?', answer: 'A história inteira é inventada', distractors: ['B', 'C'], explanation: 'Invenção', chunkId: 'trecho-1' },
    ] }), { status: 200 }));
    const questions = await requestAIStudyQuestions({ configuredOrigin: origin, currentOrigin: origin, sourceText: text, consent: true, signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(origin + '/api/studies/questions');
    expect(options.credentials).toBe('same-origin');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ consent: true, chunks: [{ chunkId: 'trecho-1', text }] });
    expect(questions).toHaveLength(1);
    expect(questions[0].options[questions[0].correctOptionIndex]).toBe('HTTP');
    expect(questions[0].sourceExcerpt).toBe(text);
    expect(questions[0].explanation).toContain('Explicação gerada por IA:');
  });

  it('reports quota failures without claiming that generation succeeded', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(requestAIStudyQuestions({ configuredOrigin: origin, currentOrigin: origin, sourceText: text, consent: true, signal: new AbortController().signal, fetcher: fetcher as unknown as typeof fetch })).rejects.toThrow('Limite temporário');
  });
});
