import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('saves multiple materials once, processes immediately, and persists source-linked cards and questions', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const files = [1, 2, 3].map((n) => new File([definitions], `aula-${n}.txt`, { type: 'text/plain', lastModified: n }));
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files } });
    expect(screen.getByText('3 arquivo(s) na preparação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText(/Original e texto extraído estão associados à disciplina/);
    await waitFor(async () => {
      expect(await fileRepository.getAll()).toHaveLength(3);
      expect(await studyTopicRepository.getAll()).toHaveLength(3);
      expect(await studyFlashcardRepository.getAll()).toHaveLength(12);
      expect(await studyQuestionRepository.getAll()).toHaveLength(12);
    });
    const [storedFile] = await fileRepository.getAll();
    expect(storedFile.extraction?.text).toBe(definitions);
    const [card] = await studyFlashcardRepository.getAll();
    expect(card).toMatchObject({ disciplineId: 'software', sourceFileId: expect.any(String), sourceFileName: expect.stringMatching(/aula-/), topicId: expect.any(String) });
    const [question] = await studyQuestionRepository.getAll();
    expect(question.options[question.correctOptionIndex]).toBe(question.explanation?.replace(/^Trecho de origem: [^:]+:\s*/, ''));
  });

  it('preserves successful output when a sibling file has an unsupported format', async () => {
    render(<StudyMaterialImporter disciplineId="software" />);
    const valid = new File([definitions], 'material.txt', { type: 'text/plain' });
    const invalid = new File(['binary'], 'planilha.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [valid, invalid] } });
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
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [new File(['Texto de aula sem definições explícitas.'], 'resumo.txt')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/não encontrei novas definições explícitas suficientes/)).toBeInTheDocument();
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
    expect(await screen.findByText(/4 flashcard\(s\) e 4 questão\(ões\) gerados/)).toBeInTheDocument();
    expect(await fileRepository.getAll()).toHaveLength(1);
    expect((await studyFlashcardRepository.getAll())[0].sourceFileId).toBe('scanned-pdf');
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
      const [card] = await studyFlashcardRepository.getAll();
      expect(card).toMatchObject({ topicId: topic.id, sourceFileId: topic.sourceFileId });
      const file = await fileRepository.getById(topic.sourceFileId!);
      expect(file?.processing?.status).toBe('completed');
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
      expect((await studyQuestionRepository.getAll()).filter((question) => question.topicId === topic.id)).toHaveLength(4);
      expect((await fileRepository.getById('material-legado'))?.processing?.status).toBe('completed');
    });
  });

});
