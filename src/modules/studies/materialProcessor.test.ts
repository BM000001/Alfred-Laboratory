import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileRepository, studyTopicRepository, studyFlashcardRepository, studyQuestionRepository } from '../../storage/repositories';
import { processStoredMaterial } from './materialProcessor';
import { extractTextDocument } from '../files/documentExtractor';
vi.mock('../files/documentExtractor', () => ({ extractTextDocument: vi.fn() }));
const extraction = { format: 'txt' as const, text: 'Mitose: divisão celular que mantém o número de cromossomos.', characterCount: 60, wordCount: 10, extractedAt: '2026-11-12' };
async function save(id = 'f') {
  await fileRepository.save({ id, disciplineId: 'd', name: 'a.txt', type: 'text/plain', blob: new Blob(['source']), size: 6, createdAt: '2026-11-12' });
}
beforeEach(async () => {
  vi.resetAllMocks();
  await Promise.all([fileRepository.clear(), studyTopicRepository.clear(), studyFlashcardRepository.clear(), studyQuestionRepository.clear()]);
  vi.mocked(extractTextDocument).mockResolvedValue({ ...extraction, fileName: 'a.txt' });
});
describe('persistent processing', () => {
  it('saves four distinct artifacts and provenance', async () => {
    await save(); const progress: string[] = [];
    const result = await processStoredMaterial('f', 'prose', new AbortController().signal, detail => progress.push(detail));
    expect(result.state.raw?.text).toBe(extraction.text); expect(result.state.corrected).toBe(extraction.text);
    expect(result.state.structured?.definitions).toHaveLength(1); expect(result.state.generated?.flashcards).toHaveLength(1);
    expect((await studyFlashcardRepository.getAll())[0]).toMatchObject({ sourceFileId: 'f', disciplineId: 'd', sourceExcerpt: extraction.text });
    expect(progress).toContain('Resultados salvos');
  });
  it('does not repeat OCR or generation after completion', async () => {
    await save();
    await processStoredMaterial('f', 'prose', new AbortController().signal, () => {});
    await processStoredMaterial('f', 'prose', new AbortController().signal, () => {});
    expect(extractTextDocument).toHaveBeenCalledTimes(1);
    expect(await studyFlashcardRepository.getAll()).toHaveLength(1);
    expect(await studyTopicRepository.getAll()).toHaveLength(1);
  });
  it('resumes after cancellation without repeating completed OCR', async () => {
    await save(); const controller = new AbortController();
    await expect(processStoredMaterial('f', 'prose', controller.signal, detail => { if (detail === 'Texto bruto reconhecido') controller.abort(); })).rejects.toThrow();
    expect((await fileRepository.getById('f'))?.processing?.status).toBe('cancelled');
    await processStoredMaterial('f', 'prose', new AbortController().signal, () => {});
    expect(extractTextDocument).toHaveBeenCalledTimes(1);
  });
  it('preserves valid files when another file fails', async () => {
    await save('good'); await save('bad');
    await processStoredMaterial('good', 'prose', new AbortController().signal, () => {});
    vi.mocked(extractTextDocument).mockRejectedValueOnce(new Error('Formato incompatível'));
    await expect(processStoredMaterial('bad', 'prose', new AbortController().signal, () => {})).rejects.toThrow('Formato incompatível');
    expect((await fileRepository.getById('good'))?.processing?.status).toBe('completed');
    expect((await fileRepository.getById('bad'))?.blob).toBeDefined();
    expect(await studyFlashcardRepository.getAll()).toHaveLength(1);
  });
  it('blocks resources when image OCR is uncertain', async () => {
    await save(); vi.mocked(extractTextDocument).mockResolvedValueOnce({ ...extraction, fileName: 'a.jpg', format: 'image', confidence: 45, imageQuality: 95 });
    const result = await processStoredMaterial('f', 'board', new AbortController().signal, () => {});
    expect(result.state.generated?.flashcards).toEqual([]); expect(await studyFlashcardRepository.getAll()).toEqual([]);
  });
});

it('asks only about conflicting definitions and preserves the raw text', async () => {
  const { confirmMaterialDefinition } = await import('./materialProcessor');
  await save();
  const conflict = extraction.text + '\nMitose: divisão celular que reduz o número de cromossomos.';
  vi.mocked(extractTextDocument).mockResolvedValueOnce({ ...extraction, fileName: 'a.txt', text: conflict });
  const state = await processStoredMaterial('f', 'prose', new AbortController().signal, () => {});
  expect(state.state.status).toBe('review'); expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
  await confirmMaterialDefinition('f', extraction.text);
  const resumed = await processStoredMaterial('f', 'prose', new AbortController().signal, () => {});
  expect(resumed.state.raw?.text).toBe(conflict); expect(resumed.state.generated?.flashcards).toHaveLength(1);
  expect(extractTextDocument).toHaveBeenCalledTimes(1);
});

it('mantém uma retomada na unidade original quando duas unidades usam o mesmo arquivo', async () => {
  await save();
  const first = { id: 'u1', title: 'Primeira unidade', disciplineId: 'd', sourceFileId: 'f',
    status: 'pending' as const, createdAt: '2026-11-12' };
  const second = { ...first, id: 'u2', title: 'Segunda unidade' };
  await studyTopicRepository.save(first);
  await studyTopicRepository.save(second);
  const interrupted = new AbortController();
  await expect(processStoredMaterial('f', 'printed', interrupted.signal, (detail) => {
    if (detail === 'Texto bruto reconhecido') interrupted.abort();
  }, undefined, first)).rejects.toThrow();
  await expect(processStoredMaterial('f', 'printed', new AbortController().signal, () => {}, undefined, second))
    .rejects.toThrow(/unidade em que/);
  expect((await fileRepository.getById('f'))?.processing).toMatchObject({ status: 'cancelled', topicId: first.id });
  await processStoredMaterial('f', 'printed', new AbortController().signal, () => {}, undefined, first);
  await processStoredMaterial('f', 'printed', new AbortController().signal, () => {}, undefined, second);
  expect((await studyFlashcardRepository.getAll()).map((card) => card.topicId).sort()).toEqual([first.id, second.id]);
  expect(extractTextDocument).toHaveBeenCalledTimes(1);
});

it('continua sem escolher um trecho e preserva ambas as definições em disputa', async () => {
  const { confirmMaterialDefinition } = await import('./materialProcessor');
  await save();
  const text = extraction.text + '\nMitose: divisão celular que reduz o número de cromossomos.\nOsmose: fluxo de água através de uma membrana semipermeável.';
  vi.mocked(extractTextDocument).mockResolvedValueOnce({ ...extraction, text, fileName: 'a.txt' });
  const run = () => processStoredMaterial('f', 'printed', new AbortController().signal, () => {});
  expect((await run()).state.status).toBe('review');
  await confirmMaterialDefinition('f', null);
  const { state } = await run();
  expect(state).toMatchObject({ status: 'completed', corrected: text, raw: { text } });
  expect((await studyFlashcardRepository.getAll()).map(card => card.subject)).toEqual(['Osmose']);
});

it('retoma um checkpoint legado marcado por estados de execução sem pedir escolha', async () => {
  await save();
  const stored = (await fileRepository.getById('f'))!;
  const text = 'Heroi | Vida: 30 | Posição: (0, 0)\nHeroi | Vida: 27 | Posição: (2, 1)';
  await fileRepository.save({ ...stored, processing: {
    version: 1, profile: 'printed', status: 'review', stage: 'Revisão',
    raw: { ...extraction, text }, corrected: text,
  } });
  const { state } = await processStoredMaterial('f', 'printed', new AbortController().signal, () => {});
  expect(state).toMatchObject({ status: 'completed', corrected: text, raw: { text } });
  expect(state.generated?.flashcards).toHaveLength(0);
  expect(extractTextDocument).not.toHaveBeenCalled();
});

it('não cria questões ou flashcards locais no modo que exige IA real', async () => {
  await save('awaiting');
  const result = await processStoredMaterial(
    'awaiting', 'prose', new AbortController().signal, () => {},
    undefined, undefined, { requireAI: true },
  );
  expect(result.state.status).toBe('awaiting-ai');
  expect(result.state.raw?.text).toBe(extraction.text);
  expect(result.state.structured?.definitions).toHaveLength(1);
  expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
  expect(await studyQuestionRepository.getAll()).toHaveLength(0);
  expect((await fileRepository.getById('awaiting'))?.processing?.status).toBe('awaiting-ai');
});
