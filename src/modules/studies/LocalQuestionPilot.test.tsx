import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fileRepository, studyGeneratedQuestionRepository, studyQuestionRepository, studyTopicRepository } from '../../storage/repositories';
import { LocalQuestionPilot } from './LocalQuestionPilot';
import { OllamaStudyEnhancementProvider } from './ollamaStudyEnhancement';
import { QuestionBank } from './QuestionBank';
import type { StudyTopic } from './types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('revisa antes de salvar, reabre o banco, corrige e mantém o histórico', async () => {
  vi.stubGlobal('crypto', {
    randomUUID: crypto.randomUUID.bind(crypto),
    subtle: { digest: async () => new Uint8Array(32).buffer },
  });
  const text = 'A clorofila absorve luz que fornece energia para a fotossíntese.';
  const topic: StudyTopic = { id: 'pilot-topic', disciplineId: 'pilot-discipline', title: 'Fotossíntese', sourceFileId: 'pilot-source', status: 'pending', createdAt: '' };
  await studyTopicRepository.save(topic);
  await fileRepository.save({
    id: 'pilot-source', disciplineId: topic.disciplineId, name: 'fonte.txt', type: 'text/plain',
    size: text.length, blob: new Blob([text]), createdAt: '',
    extraction: { format: 'txt', text, characterCount: text.length, wordCount: 11, extractedAt: '' },
  });
  vi.spyOn(OllamaStudyEnhancementProvider.prototype, 'enhance').mockImplementation(async request => ({
    version: 1, requestId: request.requestId, status: 'ready', providerKind: 'ai', flashcards: [], evidence: [], warnings: [],
    questions: [{
      prompt: 'Qual pigmento absorve a luz?', options: ['Clorofila', 'Hemoglobina', 'Melanina'],
      correctOptionIndex: 0, explanation: 'O trecho identifica a clorofila.', difficulty: 'medium',
      evidence: [{ chunkId: 'trecho-1', excerpt: text }],
    }],
  }));
  const pilot = render(<LocalQuestionPilot topic={topic} onSaved={async () => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gerar e revisar questões no Ollama' }));
  expect(await screen.findByText(text)).toBeInTheDocument();
  expect((await studyQuestionRepository.getAll()).filter(question => question.topicId === topic.id)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar e salvar' }));
  expect(await screen.findByText('Questão aprovada e salva no banco.')).toBeInTheDocument();
  const saved = (await studyQuestionRepository.getAll()).find(question => question.topicId === topic.id);
  expect(saved).toMatchObject({ sourceExcerpt: text, sourceFileId: 'pilot-source', topicId: topic.id });
  await expect(studyGeneratedQuestionRepository.save({ ...saved!, prompt: 'Tentativa de sobrescrita' })).rejects.toMatchObject({ name: 'ConstraintError' });
  pilot.unmount();

  const props = { disciplineId: topic.disciplineId, topics: [topic], unitId: topic.id };
  const bank = render(<QuestionBank {...props} />);
  expect(await screen.findByText('Qual pigmento absorve a luz?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulado' }));
  fireEvent.click(screen.getByRole('radio', { name: /clorofila/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Corrigir resposta' }));
  expect(screen.getByText('Resposta correta.')).toBeInTheDocument();
  expect(screen.getByText(/fonte.txt/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar simulado' }));
  expect(await screen.findByText('100%')).toBeInTheDocument();
  bank.unmount();

  render(<QuestionBank {...props} />);
  expect(await screen.findByText('1/1 acertos · 100%')).toBeInTheDocument();
});
