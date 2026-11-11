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
      expect(await studyFlashcardRepository.getAll()).toHaveLength(4);
      expect(await studyQuestionRepository.getAll()).toHaveLength(4);
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
    expect(await screen.findByText(/não encontrei definições explícitas suficientes/)).toBeInTheDocument();
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
    vi.spyOn(fileRepository, 'getAll').mockResolvedValue([scanned]);
    render(<StudyMaterialImporter disciplineId="software" />);
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: { files: [new File([pdfBytes], 'apostila.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/4 flashcard\(s\) e 4 questão\(ões\) gerados/)).toBeInTheDocument();
    expect(await fileRepository.getAll()).toHaveLength(1);
    expect((await studyFlashcardRepository.getAll())[0].sourceFileId).toBe('scanned-pdf');
  });
});
