import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyLearning } from './StudyLearning';
import { disciplineRepository, studyFlashcardRepository, studyLearningProgressRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';

beforeEach(async () => {
  await Promise.all([disciplineRepository.clear(), studyFlashcardRepository.clear(), studyLearningProgressRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  await disciplineRepository.save({ id: 'software', name: 'Engenharia de Software', createdAt: '' });
  await studyFlashcardRepository.save({ id: 'card-1', disciplineId: 'software', topicId: 'topic-1', subject: 'Encapsulamento', front: 'O que o material define como “Encapsulamento”?', back: 'Técnica que protege componentes internos.', createdAt: '', nextReviewAt: '2099-11-01T00:00:00.000Z', intervalDays: 7, reviewCount: 0 });
});

afterEach(() => cleanup());

describe('StudyLearning', () => {
  it('switches context and persists the learned state locally', async () => {
    const view = render(<StudyLearning disciplineId="software" topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' }]} />);
    expect(await screen.findByText('Encapsulamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir aula' }));
    expect(screen.getByText('Técnica que protege componentes internos.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
    expect(screen.getByText(/vestiário de um time/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como aprendido' }));
    expect(await screen.findByRole('button', { name: 'Explicação concluída' })).toBeInTheDocument();
    expect(await studyLearningProgressRepository.getAll()).toHaveLength(1);

    view.unmount();
    render(<StudyLearning disciplineId="software" topics={[{ id: 'topic-1', disciplineId: 'software', title: 'Orientação a objetos', status: 'pending', createdAt: '' }]} />);
    expect(await screen.findByText('1/1')).not.toBeNull();
  });
});
