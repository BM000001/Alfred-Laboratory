import { expect, it, vi } from 'vitest';
import { RemoteStudyEnhancementProvider } from './remoteStudyEnhancement';
import { generateLocalStudyQuestions, prepareLocalStudyQuestions } from './localStudyQuestions';
import type { StoredFile } from '../files/types';

const text = 'A clorofila absorve luz que fornece energia para a fotossíntese.';
const file: StoredFile = { id: 'source', disciplineId: 'science', name: 'fonte.txt', type: 'text/plain', size: text.length,
  blob: new Blob([text]), createdAt: '', extraction: { format: 'txt', text, characterCount: text.length, wordCount: 11, extractedAt: '' } };
const topic = { id: 'unit', disciplineId: 'science', title: 'Fotossíntese', status: 'pending' as const, createdAt: '', sourceFileId: 'source' };
const candidate = { question: 'Qual pigmento absorve luz?', answer: 'clorofila',
  distractors: ['Hemoglobina', 'Melanina'], explanation: 'O trecho atribui a absorção à clorofila.', chunkId: 'trecho-1' };

function setup() {
  const input = prepareLocalStudyQuestions(file, topic);
  input.request.consent = { externalProcessing: true, externalAi: true };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ questions: [candidate] }));
  return { input, fetcher, provider: new RemoteStudyEnhancementProvider(fetcher) };
}

it('requires consent and sends only displayed text and chunk IDs to the same origin', async () => {
  const { input, fetcher, provider } = setup();
  await expect(provider.enhance({ ...input.request, consent: { externalProcessing: true, externalAi: false } })).rejects.toThrow(/autorize/i);
  expect(fetcher).not.toHaveBeenCalled();
  await expect(generateLocalStudyQuestions(provider, input, [], undefined, 'remote')).resolves.toMatchObject({
    questions: [{ prompt: candidate.question, evidence: [{ chunkId: 'trecho-1', excerpt: text }] }],
  });
  const [path, options] = fetcher.mock.calls[0];
  expect(path).toBe('/api/studies/questions');
  expect(options).toMatchObject({ credentials: 'same-origin', redirect: 'manual', headers: { 'Content-Type': 'application/json' } });
  expect(JSON.parse(String(options?.body))).toEqual({ consent: true, chunks: [{ chunkId: 'trecho-1', text }] });
});

it('rejects false citations, maps insufficient material and rejects malformed output', async () => {
  const { input, fetcher, provider } = setup();
  fetcher.mockResolvedValueOnce(Response.json({ questions: [{ ...candidate, chunkId: 'unknown' }] }));
  await expect(generateLocalStudyQuestions(provider, input, [], undefined, 'remote')).resolves.toEqual({ generated: 1, questions: [] });
  fetcher.mockResolvedValueOnce(Response.json({ questions: [] }));
  await expect(provider.enhance(input.request)).resolves.toMatchObject({ status: 'insufficient_evidence' });
  fetcher.mockResolvedValueOnce(new Response('<html>login</html>'));
  await expect(provider.enhance(input.request)).rejects.toThrow(/inválida/);
});

it('reports lack of authorization, quota, provider outage and lost connection', async () => {
  const { input, fetcher, provider } = setup();
  for (const [status, message] of [[401, /autorização/], [403, /autorização/], [429, /2 min/], [503, /indisponível/]] as const) {
    fetcher.mockResolvedValueOnce(new Response(null, { status, headers: { 'Retry-After': '120' } }));
    await expect(provider.enhance(input.request)).rejects.toThrow(message);
  }
  fetcher.mockRejectedValueOnce(new TypeError('network'));
  await expect(provider.enhance(input.request)).rejects.toThrow(/sem conexão/i);
});

it('cancels the request and does not turn abort into an outage', async () => {
  const { input, fetcher, provider } = setup();
  fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  }));
  const controller = new AbortController();
  const pending = provider.enhance(input.request, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
