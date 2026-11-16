import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './Assistant';
import { assistantMessageRepository, taskRepository } from '../storage/repositories';
import type { Task } from './tasks/types';

const task: Task = {
  id: 'assistant-write-retry-task',
  title: 'Revisar apresentação',
  status: 'pending',
  priority: 'medium',
  createdAt: '2026-11-01T10:00:00.000Z',
};

beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await assistantMessageRepository.clear();
  const existing = await taskRepository.getAll();
  await Promise.all(existing.map((item) => taskRepository.delete(item.id)));
  await taskRepository.save(task);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assistant write failure recovery', () => {
  it('não confirma uma escrita que falhou e permite repetir a aprovação', async () => {
    const user = userEvent.setup();
    render(<Assistant />);
    await waitFor(() => expect(screen.getByLabelText('Mensagem para Alfred')).toBeEnabled());

    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'concluir tarefa Revisar apresentação');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const approve = await screen.findByRole('button', { name: 'Confirmar alteração' });

    const originalSave = taskRepository.save.bind(taskRepository);
    const save = vi.spyOn(taskRepository, 'save')
      .mockRejectedValueOnce(new Error('Falha simulada ao gravar no IndexedDB'))
      .mockImplementation((item) => originalSave(item));

    await user.click(approve);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha simulada ao gravar no IndexedDB');
    expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'pending' });
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeEnabled();
    expect(screen.queryByText('Confirmado. A tarefa “Revisar apresentação” foi marcada como concluída.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(async () => {
      expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'completed' });
    });
    expect(await screen.findByText('Confirmado. A tarefa “Revisar apresentação” foi marcada como concluída.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
