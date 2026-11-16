import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyMaterialImporter } from './StudyMaterialImporter';
import { disciplineRepository, fileRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../../storage/repositories';

vi.mock('../files/imageOcrExtractor', () => ({
  extractImageTextWithLocalOcr: vi.fn(async (_file: File, onProgress?: (progress: { progress: number; status: string }) => void) => {
    onProgress?.({ progress: 0.5, status: 'Reconhecendo texto da foto localmente' });
    return { text: 'Fotossíntese: processo pelo qual as plantas convertem luz em energia química.', confidence: 96, language: 'por' as const };
  }),
}));

const definitions = [
  'Encapsulamento: técnica que protege componentes e estruturas internas dos programas contra acessos indevidos.',
  'Herança: relação que permite reutilizar componentes e estruturas já definidas por outros programas.',
  'Polimorfismo: capacidade de alterar comportamentos de componentes e estruturas durante a execução dos programas.',
  'Abstração: representação que simplifica componentes e estruturas para facilitar a análise dos programas.',
].join('\n');

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([disciplineRepository.clear(), fileRepository.clear(), studyTopicRepository.clear(), studyFlashcardRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  await disciplineRepository.save({ id: 'software', name: 'Engenharia de Software', createdAt: '2026-11-11T12:00:00.000Z' });
});

afterEach(() => cleanup());

describe('StudyMaterialImporter', () => {
  it('stages a gallery photo and runs local OCR when Save is pressed', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const photo = new File(['photo-bytes'], 'anotacao.jpg', { type: 'image/jpeg', lastModified: 42 });
    const input = screen.getByLabelText('Escolher arquivos ou fotos');
    expect(input).toHaveAttribute('accept', expect.stringContaining('image/*'));
    fireEvent.change(input, { target: { files: [photo] } });
    expect(screen.getByText(/anotacao.jpg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/Texto reconhecido por OCR/)).toBeInTheDocument();
    const [stored] = await fileRepository.getAll();
    expect(stored).toMatchObject({ name: 'anotacao.jpg', disciplineId: 'software', extraction: { format: 'image', extractionMethod: 'ocr', confidence: 96, language: 'por', text: 'Fotossíntese: processo pelo qual as plantas convertem luz em energia química.' } });
    expect((await studyFlashcardRepository.getAll()).length).toBeGreaterThan(0);
    expect((await studyFlashcardRepository.getAll())[0].sourceFileName).toBe('anotacao.jpg');
  });

  it('saves multiple materials once, processes immediately, and persists source-linked cards and questions', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const files = [1, 2, 3].map((n) => new File([definitions], `aula-${n}.txt`, { type: 'text/plain', lastModified: n }));
    fireEvent.change(screen.getByLabelText('Escolher arquivos ou fotos'), { target: { files } });
    expect(screen.getByText('3 arquivo(s) na preparação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getAllByText(/Original e etapas preservados localmente/).length).toBeGreaterThan(0));
    await waitFor(async () => {
      expect(screen.getAllByText('Pronto')).toHaveLength(3);
      expect(await fileRepository.getAll()).toHaveLength(3);
      expect(await studyTopicRepository.getAll()).toHaveLength(3);
      expect(await studyFlashcardRepository.getAll()).toHaveLength(4);
      expect(await studyQuestionRepository.getAll()).toHaveLength(4);
    });
    const [storedFile] = await fileRepository.getAll();
    expect(storedFile.extraction?.text).toBe(definitions);
    const [card] = await studyFlashcardRepository.getAll();
    expect(card).toMatchObject({ disciplineId: 'software', sourceFileId: expect.any(String), sourceFileName: expect.stringMatching(/aula-/), topicId: expect.any(String) });
    const [question] = await studyQuestionRepository.getAll();
    expect(question.options[question.correctOptionIndex]).toBe(question.subject);
  });

  it('preserves successful output when a sibling file has an unsupported format', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const valid = new File([definitions], 'material.txt', { type: 'text/plain' });
    const invalid = new File(['binary'], 'planilha.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('Escolher arquivos ou fotos'), { target: { files: [valid, invalid] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/Formato ainda não suportado/)).toBeInTheDocument();
    await waitFor(async () => {
      expect(await studyFlashcardRepository.getAll()).toHaveLength(4);
      expect(await fileRepository.getAll()).toHaveLength(2);
    });
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText('Falha neste arquivo')).toBeInTheDocument();
    expect(screen.getByText(/O original foi preservado na biblioteca/)).toBeInTheDocument();
  });

  it('does not generate unsupported resources for ordinary prose', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    fireEvent.change(screen.getByLabelText('Escolher arquivos ou fotos'), { target: { files: [new File(['Texto de aula sem definições explícitas.'], 'resumo.txt')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Não encontrei definições explícitas suficientes/)).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('Escolher arquivos ou fotos'), { target: { files: [new File([pdfBytes], 'apostila.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/4 flashcards e 4 questões validados/)).toBeInTheDocument();
    expect(await fileRepository.getAll()).toHaveLength(1);
    expect((await studyFlashcardRepository.getAll())[0].sourceFileId).toBe('scanned-pdf');
  });
});

it('keeps processing valid siblings when saving an oversized original fails', async () => {
  render(<StudyMaterialImporter disciplineId="software" />);
  const invalid = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.bin');
  const valid = new File([definitions], 'valido.txt', { type: 'text/plain' });
  fireEvent.change(screen.getByLabelText('Escolher arquivos ou fotos'), { target: { files: [invalid, valid] } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(await screen.findByText(/O arquivo deve ter no máximo 10 MB/)).toBeInTheDocument();
  await screen.findByText('Pronto');
  expect(await fileRepository.getAll()).toHaveLength(1);
  expect(await studyFlashcardRepository.getAll()).toHaveLength(4);
});
