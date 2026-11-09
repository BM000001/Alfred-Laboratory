import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './Assistant';
import { assistantMessageRepository, taskRepository } from '../storage/repositories';
import type { Task } from './tasks/types';

beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await assistantMessageRepository.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assistant loading state', () => {
  it('bloqueia o envio enquanto consulta dados locais e libera o campo ao terminar', async () => {
    const user = userEvent.setup();
    const originalGetAll = taskRepository.getAll.bind(taskRepository);
    let finishRead: ((tasks: Task[]) => void) | undefined;

    render(<Assistant />);
    await waitFor(() => expect(screen.getByLabelText('Mensagem para Alfred')).toBeEnabled());

    vi.spyOn(taskRepository, 'getAll').mockImplementationOnce(() =>
      new Promise<Task[]>((resolve) => { finishRead = resolve; }),
    );

    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'Quais tarefas estão pendentes?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Consultando seus dados locais…');
    expect(screen.getByLabelText('Mensagem para Alfred')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).not.toBeInTheDocument();

    expect(finishRead).toBeDefined();
    finishRead!(await originalGetAll());

    expect(await within(screen.getByRole('log')).findByText((text) =>
      text.includes('tarefa(s) pendente(s) encontrada(s).') || text.includes('Nenhuma tarefa pendente encontrada.'),
    )).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Mensagem para Alfred')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });
});
