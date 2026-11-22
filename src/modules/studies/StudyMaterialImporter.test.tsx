import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyMaterialImporter } from './StudyMaterialImporter';
import { disciplineRepository, fileRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../../storage/repositories';

const definitions = [
  'Encapsulamento: mecanismo que protege os dados internos de um objeto.',
  'Herança: relação que permite reutilizar características definidas em outra classe.',
  'Polimorfismo: capacidade de responder de formas diferentes a uma mesma operação.',
  'Abstração: processo que representa somente aspectos importantes de uma entidade.',
].join('\n');

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([disciplineRepository.clear(), fileRepository.clear(), studyTopicRepository.clear(), studyFlashcardRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  await disciplineRepository.save({ id: 'software', name: 'Engenharia de Software', createdAt: '2026-11-11T12:00:00.000Z' });
});

afterEach(() => cleanup());

describe('StudyMaterialImporter', () => {
  it('stores and analyzes multiple originals without creating unverified local questions', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const files = [1, 2, 3].map((n) => new File([definitions], `aula-${n}.txt`, { type: 'text/plain', lastModified: n }));
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files } });
    expect(screen.getByText('3 arquivo(s) na preparação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText(/Original e texto extraído estão associados à disciplina/);
    await waitFor(async () => {
      expect(await fileRepository.getAll()).toHaveLength(3);
      expect(await studyTopicRepository.getAll()).toHaveLength(3);
      expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
      expect(await studyQuestionRepository.getAll()).toHaveLength(0);
    });
    const [storedFile] = await fileRepository.getAll();
    expect(storedFile.extraction?.text).toBe(definitions);
    expect((await fileRepository.getAll()).every(file => file.processing?.status === 'awaiting-ai')).toBe(true);
    expect((await studyTopicRepository.getAll()).every(topic => Boolean(topic.sourceFileId))).toBe(true);
  });

  it('persists all originals before processing and resumes the queued file after cancellation', async () => {
    const persist = fileRepository.save.bind(fileRepository);
    let release: () => void = () => {};
    const blocked = new Promise<void>(resolve => { release = resolve; });
    let paused = false;
    vi.spyOn(fileRepository, 'save').mockImplementation(async item => {
      await persist(item);
      if (!paused && item.processing?.status === 'running' && item.processing.stage === 'Preparando material') {
        paused = true;
        await blocked;
      }
    });
    const view = render(<StudyMaterialImporter disciplineId="software" />);
    const files = ['primeiro.txt', 'segundo.txt'].map(name => new File([definitions], name, { type: 'text/plain' }));
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    try {
      await waitFor(() => expect(paused).toBe(true));
      expect((await fileRepository.getAll()).map(file => file.name).sort()).toEqual(['primeiro.txt', 'segundo.txt']);
      fireEvent.click(screen.getByRole('button', { name: 'Interromper processamento' }));
    } finally {
      release();
    }
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Interromper processamento' })).toBeNull());
    view.unmount();
    render(<StudyMaterialImporter disciplineId="software" />);
    const row = (await screen.findByText('segundo.txt')).closest('article');
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole('button', { name: 'Retomar processamento' }));
    await waitFor(async () => {
      const stored = await fileRepository.getAll();
      expect(stored).toHaveLength(2);
      expect(stored.find(file => file.name === 'segundo.txt')?.processing?.status).toBe('awaiting-ai');
    });
  });

  it('preserves the analyzed original when a sibling file has an unsupported format', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const valid = new File([definitions], 'material.txt', { type: 'text/plain' });
    const invalid = new File(['binary'], 'planilha.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [valid, invalid] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/Formato ainda não suportado/)).toBeInTheDocument();
    await waitFor(async () => {
      expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
      expect(await fileRepository.getAll()).toHaveLength(2);
    });
    expect(screen.getByText('Aguardando IA')).toBeInTheDocument();
    expect(screen.getByText('Falha neste arquivo')).toBeInTheDocument();
    expect(screen.getByText(/O original foi preservado na biblioteca/)).toBeInTheDocument();
  });

  it('does not generate unsupported resources for ordinary prose', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [new File(['Texto de aula sem definições explícitas.'], 'resumo.txt')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/aguarda a conexão com uma IA real/i)).toBeInTheDocument();
    expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
    expect(await fileRepository.getAll()).toHaveLength(1);
  });

  it('reuses a previously saved local OCR extraction for a scanned PDF', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
    const savedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const scanned: import('../files/types').StoredFile = {
      id: 'scanned-pdf', name: 'apostila.pdf', type: 'application/pdf', size: savedBlob.size,
      createdAt: '2026-11-11T12:00:00.000Z', disciplineId: 'software', blob: savedBlob,
      extraction: { format: 'pdf', text: definitions, characterCount: definitions.length, wordCount: 25, extractedAt: '2026-11-11T12:00:00.000Z', extractionMethod: 'ocr', language: 'por', pageCount: 1, pages: [{ pageNumber: 1, text: definitions, method: 'ocr', confidence: 92 }] },
    };
    await fileRepository.save(scanned);
    vi.spyOn(fileRepository, 'getAll').mockResolvedValue([scanned]);
    render(<StudyMaterialImporter disciplineId="software" />);
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [new File([pdfBytes], 'apostila.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/aguarda a conexão com uma IA real/)).toBeInTheDocument();
    expect(await fileRepository.getAll()).toHaveLength(1);
    expect((await fileRepository.getById('scanned-pdf'))?.processing?.status).toBe('awaiting-ai');
    expect((await fileRepository.getById('scanned-pdf'))?.extraction?.text).toBe(definitions);
  });
  it('reabre a revisão de fonte após remontar e continua na unidade original', async () => {
    const view = render(<StudyMaterialImporter disciplineId="software" />);
    const source = 'Mitose: divisão celular que mantém o número de cromossomos.';
    const alternative = 'Mitose: divisão celular que reduz o número de cromossomos.';
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: {
      files: [new File([source + '\n' + alternative], 'revisao.txt', { type: 'text/plain' })],
    } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('button', { name: `Manter: ${source}` });
    const [topic] = await studyTopicRepository.getAll();
    expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
    view.unmount();
    render(<StudyMaterialImporter disciplineId="software" unit={topic} />);
    fireEvent.click(await screen.findByRole('button', { name: `Manter: ${source}` }));
    await waitFor(async () => {
      expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
      const file = await fileRepository.getById(topic.sourceFileId!);
      expect(file?.processing?.status).toBe('awaiting-ai');
      expect(file?.extraction?.text).toContain(alternative);
    });
  });

  it('retoma um checkpoint histórico que ainda não tem unidade vinculada', async () => {
    const raw = {
      format: 'txt' as const, text: definitions, characterCount: definitions.length,
      wordCount: 35, extractedAt: '2026-11-12T12:00:00.000Z',
    };
    const blob = new Blob([definitions], { type: 'text/plain' });
    await fileRepository.save({
      id: 'material-legado', name: 'legado.txt', type: 'text/plain', size: blob.size, blob,
      createdAt: raw.extractedAt, disciplineId: 'software',
      processing: { version: 1, profile: 'printed', status: 'cancelled', stage: 'Texto bruto reconhecido', raw },
    });
    render(<StudyMaterialImporter disciplineId="software" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retomar processamento' }));
    await waitFor(async () => {
      const [topic] = await studyTopicRepository.getAll();
      expect(topic).toMatchObject({ sourceFileId: 'material-legado' });
      expect((await studyQuestionRepository.getAll()).filter((question) => question.topicId === topic.id)).toHaveLength(0);
      expect((await fileRepository.getById('material-legado'))?.processing?.status).toBe('awaiting-ai');
    });
  });

  it('reuses equal files and retains equal-sized files differing after the first block', async () => {
    // fake-indexeddb's structured clone does not retain jsdom Blob objects.
    const blobs = new Map<string, Blob>();
    const save = fileRepository.save.bind(fileRepository);
    const list = fileRepository.getAll.bind(fileRepository);
    vi.spyOn(fileRepository, 'save').mockImplementation(item => {
      if (item.blob instanceof Blob) blobs.set(item.id, item.blob);
      return save(item);
    });
    vi.spyOn(fileRepository, 'getAll').mockImplementation(async () => (await list())
      .map(item => ({ ...item, blob: blobs.get(item.id) ?? item.blob })));
    render(<StudyMaterialImporter disciplineId="software" />);
    const picker = screen.getByLabelText('Adicionar arquivos');
    const common = 'x'.repeat(256 * 1024);
    const upload = (suffix: string) => fireEvent.change(picker, { target: { files: [
      new File([common + suffix], 'material.bin', { type: 'application/octet-stream' }),
    ] } });
    for (const suffix of ['a', 'a', 'b']) {
      upload(suffix);
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await screen.findByText(/Formato ainda não suportado/);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Interromper processamento' })).toBeNull());
    }
    expect(await list()).toHaveLength(2);
  });
});
