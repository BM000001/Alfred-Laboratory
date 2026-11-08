import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './Assistant';
import { assistantMessageRepository, taskRepository } from '../storage/repositories';
import type { Task } from './tasks/types';

const task: Task = {
  id: 'assistant-approval-task',
  title: 'Preparar apresentação',
  status: 'pending',
  priority: 'medium',
  createdAt: '2026-11-01T10:00:00.000Z',
};

let messageCounter = 0;

beforeEach(async () => {
  messageCounter = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `assistant-test-message-${++messageCounter}` });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await assistantMessageRepository.clear();
  const existing = await taskRepository.getAll();
  await Promise.all(existing.map((item) => taskRepository.delete(item.id)));
  await taskRepository.save(task);
});

async function renderAssistant() {
  const view = render(<Assistant />);
  await waitFor(() => expect(screen.getByLabelText('Mensagem para Alfred')).toBeEnabled());
  return view;
}

describe('Assistant task approval UI', () => {
  it('não altera a tarefa quando uma proposta é preparada ou cancelada', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'concluir tarefa Preparar apresentação');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await screen.findByRole('button', { name: 'Confirmar alteração' });
    expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'pending' });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'pending' });
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).not.toBeInTheDocument();
  });

  it('só conclui a tarefa depois do clique explícito de confirmação', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'marcar tarefa Preparar apresentação como concluída');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar alteração' }));

    await waitFor(async () => {
      expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'completed' });
    });
    expect(await screen.findByText('Confirmado. A tarefa “Preparar apresentação” foi marcada como concluída.')).toBeInTheDocument();
  });

  it('não propõe alteração se o título da tarefa não corresponder exatamente', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'concluir tarefa Apresentação');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Não encontrei uma tarefa com o título exato/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).not.toBeInTheDocument();
    expect(await taskRepository.getById(task.id)).toMatchObject({ status: 'pending' });
  });

  it('não cria tarefa ao preparar ou cancelar uma proposta', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'criar tarefa Revisar capítulo');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByRole('button', { name: 'Confirmar alteração' });

    expect(await taskRepository.getAll()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await taskRepository.getAll()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).not.toBeInTheDocument();
  });

  it('só atualiza a descrição depois da confirmação explícita', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'altere a descrição da tarefa Preparar apresentação para Incluir introdução, resultados e conclusão');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByRole('button', { name: 'Confirmar alteração' });
    expect((await taskRepository.getById(task.id))?.description).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(async () => {
      expect(await taskRepository.getById(task.id)).toMatchObject({
        description: 'Incluir introdução, resultados e conclusão',
      });
    });
    expect(await screen.findByText('Confirmado. A descrição de “Preparar apresentação” foi atualizada.')).toBeInTheDocument();
  });

  it('só cria a tarefa depois da confirmação explícita', async () => {
    const user = userEvent.setup();
    await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'adicionar tarefa: Revisar capítulo');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar alteração' }));

    await waitFor(async () => {
      expect(await taskRepository.getAll()).toHaveLength(2);
    });
    expect(await screen.findByText('Confirmado. A tarefa “Revisar capítulo” foi criada com prioridade média e adicionada às pendências.')).toBeInTheDocument();
    expect(await taskRepository.getAll()).toContainEqual(expect.objectContaining({
      title: 'Revisar capítulo', status: 'pending', priority: 'medium',
    }));
  });
  it('recupera o histórico após remontar e permite apagá-lo com confirmação', async () => {
    const user = userEvent.setup();
    const view = await renderAssistant();
    await user.type(screen.getByLabelText('Mensagem para Alfred'), 'Quais tarefas estão pendentes?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await within(screen.getByRole('log')).findByText(/Preparar apresentação/);
    await waitFor(async () => {
      const saved = await assistantMessageRepository.getAll();
      expect(saved.some((message) => message.content === 'Quais tarefas estão pendentes?')).toBe(true);
    });

    view.unmount();
    await renderAssistant();
    expect(screen.getByText('Quais tarefas estão pendentes?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar conversa' }));
    await user.click(screen.getByRole('button', { name: 'Apagar histórico' }));
    await waitFor(async () => {
      const saved = await assistantMessageRepository.getAll();
      expect(saved).toHaveLength(1);
      expect(saved[0].content).toContain('À sua disposição.');
    });
    expect(within(screen.getByRole('log')).queryByText('Quais tarefas estão pendentes?')).not.toBeInTheDocument();
  });

});
