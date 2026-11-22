import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StudyTrail } from './StudyTrail';
import { studyQuestionRepository } from '../../storage/repositories';

it('mantém nove paradas acessíveis e separa pulos por capítulo sem contar domínio', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const data = {
    discipline: { id: 's', name: 'Disciplina', createdAt: '' },
    topics: ['a', 'b'].map((id) => ({
      id,
      title: id,
      disciplineId: 's',
      createdAt: '',
      status: 'pending' as const,
    })),
    refreshToken: 0,
    onManage: vi.fn(),
    onMaterials: vi.fn(),
  };
  await studyQuestionRepository.save({
    id: 'q',
    disciplineId: 's',
    topicId: 'b',
    prompt: 'Teste?',
    options: ['A', 'B'],
    correctOptionIndex: 0,
    difficulty: 'easy',
    createdAt: '',
  });
  const view = render(<StudyTrail {...data} />);
  expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(9);
  fireEvent.click(await screen.findByRole('button', { name: /Castelo Conteúdo insuficiente/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Pular etapa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à trilha' }));
  expect(screen.getByText(/0 de 9 etapas concluídas · 1 puladas/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Capítulo'), { target: { value: 'b' } });
  fireEvent.click(await screen.findByRole('button', { name: /Campo de Alvos Disponível/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Pular etapa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.getByRole('heading', { name: 'Recordar conceitos' })).toBeInTheDocument();
  view.unmount();
  render(<StudyTrail {...data} />);
  expect(
    await screen.findByRole('button', { name: /Castelo Conteúdo insuficiente · Pulada/ }),
  ).toBeInTheDocument();
  window.dispatchEvent(new Event('offline'));
  vi.restoreAllMocks();
});
