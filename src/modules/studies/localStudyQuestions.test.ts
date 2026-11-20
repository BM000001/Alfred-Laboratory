import { describe, expect, it, vi } from 'vitest';
import type { StoredFile } from '../files/types';
import { generateLocalStudyQuestions, prepareLocalStudyQuestions } from './localStudyQuestions';
import { OLLAMA_STUDY_MODEL, OllamaStudyEnhancementProvider } from './ollamaStudyEnhancement';
import type { StudyTopic } from './types';

const excerpt = 'A clorofila absorve luz que fornece energia para a fotossíntese.';
const text = excerpt + ' A água e o dióxido de carbono participam da produção de glicose.';
const topic: StudyTopic = { id: 'unit', disciplineId: 'science', title: 'Fotossíntese', status: 'pending', createdAt: '', sourceFileId: 'source' };

function material(source = text): StoredFile {
  return {
    id: 'source', disciplineId: 'science', name: 'fotossintese.txt', type: 'text/plain',
    createdAt: '', size: source.length, blob: new Blob([source]),
    extraction: { format: 'txt', text: source, characterCount: source.length, wordCount: 20, extractedAt: '' },
  };
}

const candidate = {
  question: 'Qual pigmento absorve a luz?', answer: 'Clorofila', distractors: ['Hemoglobina', 'Melanina'],
  explanation: 'A clorofila absorve a luz para a fotossíntese.', chunkId: 'trecho-1',
};

function output(questions: unknown[] = [candidate]) {
  return Response.json({ model: OLLAMA_STUDY_MODEL, done: true, done_reason: 'stop', message: { content: JSON.stringify({ questions }) } });
}

function setup(response = output()) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
  const provider = new OllamaStudyEnhancementProvider(fetcher);
  return { fetcher, provider, input: prepareLocalStudyQuestions(material(), topic) };
}

describe('geração local de questões', () => {
  it('usa somente o modelo fixo no loopback e valida material suficiente', async () => {
    const { fetcher, provider, input } = setup();
    const result = await generateLocalStudyQuestions(provider, input, []);
    expect(result.generated).toBe(1);
    expect(result.questions[0]).toMatchObject({ prompt: candidate.question, evidence: [{ excerpt: text, chunkId: 'trecho-1' }] });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(init).toMatchObject({ redirect: 'error', credentials: 'omit' });
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe(OLLAMA_STUDY_MODEL);
    expect(body.messages.at(-1).content).toBe('Crie perguntas para os trechos: ' + JSON.stringify([{ chunkId: 'trecho-1', text }]));
    expect(body.format.properties.questions.maxItems).toBe(3);
  });

  it('rejeita fonte curta, conflito conhecido e falta de consentimento', async () => {
    expect(() => prepareLocalStudyQuestions(material('Clorofila'), topic)).toThrow(/insuficiente/i);
    const conflict = 'Latência: é o tempo até a primeira resposta.\nLatência: é a quantidade de respostas por segundo.';
    expect(() => prepareLocalStudyQuestions(material(conflict), topic)).toThrow(/conflitantes/);
    const { provider, input, fetcher } = setup();
    await expect(provider.enhance({ ...input.request, consent: { externalProcessing: false, externalAi: false } })).rejects.toThrow(/autorize/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserva o resultado insuficiente do modelo', async () => {
    const { provider, input } = setup(output([]));
    await expect(generateLocalStudyQuestions(provider, input, [])).resolves.toEqual({ generated: 0, questions: [] });
  });

  it('rejeita citação inventada, alternativas repetidas e a mesma pergunta em uma nova solicitação', async () => {
    const { provider, input, fetcher } = setup(output([
      { ...candidate, chunkId: 'trecho-inventado' },
      { ...candidate, distractors: [' clorofila ', 'Melanina'] },
      candidate,
    ]));
    await expect(generateLocalStudyQuestions(provider, input, [])).resolves.toMatchObject({ generated: 3, questions: [expect.objectContaining({ prompt: candidate.question })] });
    fetcher.mockResolvedValue(output([
      { ...candidate, answer: 'Hemoglobina', distractors: ['Miosina', 'Melanina'] },
      { ...candidate, question: excerpt },
      { ...candidate, distractors: ['Clorofila, mas só à noite', 'Melanina'] },
    ]));
    await expect(generateLocalStudyQuestions(provider, input, [])).resolves.toEqual({ generated: 3, questions: [] });
    fetcher.mockResolvedValue(output([candidate, { ...candidate, question: ' ' + candidate.question.toUpperCase() }]));
    await expect(generateLocalStudyQuestions(provider, input, [])).resolves.toMatchObject({ generated: 2, questions: [expect.objectContaining({ prompt: candidate.question })] });
    fetcher.mockResolvedValue(output());
    await expect(generateLocalStudyQuestions(provider, input, [candidate.question])).resolves.toEqual({ generated: 1, questions: [] });
  });

  it('rejeita JSON inválido e saídas com mais de três questões', async () => {
    const { provider, input, fetcher } = setup(Response.json({ model: OLLAMA_STUDY_MODEL, done: true, done_reason: 'stop', message: { content: '{' } }));
    await expect(provider.enhance(input.request)).rejects.toThrow(/JSON inválida/);
    fetcher.mockResolvedValue(output(Array(4).fill(candidate)));
    await expect(provider.enhance(input.request)).rejects.toThrow(/JSON inválida/);
  });

  it('cancela uma solicitação em andamento', async () => {
    const { provider, input, fetcher } = setup();
    fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const controller = new AbortController();
    const pending = generateLocalStudyQuestions(provider, input, [], controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('informa quando o modelo ou o serviço está indisponível', async () => {
    const { provider, input, fetcher } = setup(new Response(null, { status: 404 }));
    await expect(provider.enhance(input.request)).rejects.toThrow(/não está instalado/);
    fetcher.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(provider.enhance(input.request)).rejects.toThrow(/indisponível/);
  });
});
