import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fileRepository, studyGeneratedQuestionRepository, studyQuestionRepository, studyTopicRepository } from '../../storage/repositories';
import { LocalQuestionPilot } from './LocalQuestionPilot';
import { OllamaStudyEnhancementProvider } from './ollamaStudyEnhancement';
import { QuestionBank } from './QuestionBank';
import type { StudyTopic } from './types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('revisa, corrige e mantém histórico (provedor remoto=%s)', async remote => {
  vi.stubGlobal('crypto', {
    randomUUID: crypto.randomUUID.bind(crypto),
    subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => bytes.slice(0, 32).buffer },
  });
  const text = 'A clorofila absorve luz que fornece energia para a fotossíntese.';
  const topic: StudyTopic = { id: 'pilot-topic-' + remote, disciplineId: 'pilot-discipline-' + remote, title: 'Fotossíntese', sourceFileId: 'pilot-source', status: 'pending', createdAt: '' };
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
  const fetcher = vi.fn(async () => Response.json({ questions: [{
    question: 'Qual pigmento absorve a luz?', answer: 'Clorofila', distractors: ['Hemoglobina', 'Melanina'],
    explanation: 'O trecho identifica a clorofila.', chunkId: 'trecho-1',
  }] }));
  vi.stubGlobal('fetch', fetcher);
  const pilot = render(<LocalQuestionPilot topic={topic} remote={remote} onSaved={async () => {}} />);
  if (remote) {
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar trechos para IA' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    const generate = screen.getByRole('button', { name: 'Gerar exercícios com IA remota' });
    expect(generate).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /autorizo/i }));
    fireEvent.click(generate);
    expect(await screen.findByRole('button', { name: 'Aprovar e salvar' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /autorizo/i })).not.toBeChecked();
    expect(fetcher).toHaveBeenCalledOnce();
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Gerar e revisar questões no Ollama' }));
  }
  expect(await screen.findByRole('button', { name: 'Aprovar e salvar' })).toBeInTheDocument();
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
