import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyLearning } from './StudyLearning';
import { fileRepository, disciplineRepository, studyFlashcardRepository, studyLearningProgressRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';

beforeEach(async () => {
  await Promise.all([fileRepository.clear(), disciplineRepository.clear(), studyFlashcardRepository.clear(), studyLearningProgressRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  await disciplineRepository.save({ id: 'software', name: 'Engenharia de Software', createdAt: '' });
  await studyFlashcardRepository.save({ id: 'card-1', disciplineId: 'software', topicId: 'topic-1', subject: 'Encapsulamento', front: 'O que o material define como “Encapsulamento”?', back: 'Técnica que protege componentes internos.', createdAt: '', nextReviewAt: '2099-11-01T00:00:00.000Z', intervalDays: 7, reviewCount: 0 });
  await studyFlashcardRepository.save({
    id: 'card-2', disciplineId: 'software', topicId: 'topic-1', subject: 'Referências em Python',
    front: 'O que significa referenciar o mesmo objeto?', back: 'As variáveis apontam para o mesmo objeto.',
    sourceExcerpt: 'Referências em Python: duas variáveis apontam para o mesmo objeto e ambas observam a alteração do atributo compartilhado.',
    createdAt: '', nextReviewAt: '2099-11-01T00:00:00.000Z', intervalDays: 7, reviewCount: 0,
  });
});

afterEach(() => cleanup());

describe('StudyLearning', () => {
  it('switches context and persists the learned state locally', async () => {
    const view = render(<StudyLearning disciplineId="software" topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' }]} />);
    expect(await screen.findByText('Referências em Python')).toBeInTheDocument();
    expect(screen.queryByText('Encapsulamento')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir aula' }));
    expect(screen.getByText('As variáveis apontam para o mesmo objeto.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
    expect(screen.getByRole('button', { name: 'Futebol' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como aprendido' }));
    expect(await screen.findByRole('button', { name: 'Explicação concluída' })).toBeInTheDocument();
    expect(await studyLearningProgressRepository.getAll()).toHaveLength(1);

    view.unmount();
    render(<StudyLearning disciplineId="software" topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' }]} />);
    expect(await screen.findByText('1/1')).not.toBeNull();
  });
});

it('exibe uma aula gerada por IA separando explicação, exemplo e trecho original', async () => {
  const text = 'HTTP é um protocolo usado para transferir informações entre clientes e servidores web.';
  await fileRepository.save({
    id: 'material', name: 'aula.txt', type: 'text/plain', size: text.length,
    blob: new Blob([text]), disciplineId: 'software', createdAt: '',
    processing: {
      version: 1, profile: 'printed', status: 'completed', stage: 'Gerado por IA', topicId: 'topic-1',
      aiLessons: [{
        id: 'lesson-ai-1', title: '**HTTP**', explanation: 'Uma explicação elaborada por IA.',
        example: 'Exemplo complementar da IA: um navegador.', check: 'Qual protocolo?',
        answer: 'HTTP', sourceExcerpt: text, createdAt: '',
      }],
    },
  });
  render(<StudyLearning disciplineId="software" topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Protocolos', status: 'pending', createdAt: '' }]} />);
  const heading = await screen.findByRole('heading', { name: 'HTTP' });
  const article = heading.closest('article')!;
  fireEvent.click(within(article).getByRole('button', { name: 'Abrir aula' }));
  expect(within(article).getByText('Uma explicação elaborada por IA.')).toBeInTheDocument();
  fireEvent.click(within(article).getByRole('button', { name: 'Etapa 2: Exemplo' }));
  expect(within(article).getByText(/Exemplo complementar da IA/)).toBeInTheDocument();
  fireEvent.click(within(article).getByRole('button', { name: 'Etapa 4: Material de origem' }));
  fireEvent.click(within(article).getByText('Consultar material de origem'));
  expect(within(article).getByText(text)).toBeInTheDocument();
  fireEvent.click(within(article).getByRole('button', { name: 'Marcar como aprendido' }));
  expect(await within(article).findByRole('button', { name: 'Aula concluída' })).toBeInTheDocument();
});

it('não apresenta conteúdo local pré-programado como aula gerada por IA na trilha', async () => {
  render(<StudyLearning aiOnly disciplineId="software"
    topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' }]} />);
  expect(await screen.findByText('Ainda não há conteúdo guiado.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Abrir aula' })).not.toBeInTheDocument();
});
