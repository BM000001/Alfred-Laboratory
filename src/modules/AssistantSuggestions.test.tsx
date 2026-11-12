import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './Assistant';
import { assistantMessageRepository } from '../storage/repositories';

beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await assistantMessageRepository.clear();
});

describe('Sugestões acessíveis do Alfred', () => {
  it('preenche e foca o campo ao selecionar uma sugestão, sem enviar automaticamente', async () => {
    const user = userEvent.setup();
    render(<Assistant />);

    const prompt = screen.getByRole('textbox', { name: 'Mensagem para Alfred' });
    await waitFor(() => expect(prompt).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Quais tarefas estão pendentes?' }));

    expect(prompt).toHaveFocus();
    expect(prompt).toHaveValue('Quais tarefas estão pendentes?');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
    expect(within(screen.getByRole('log')).queryByText('Quais tarefas estão pendentes?', { exact: true })).not.toBeInTheDocument();
  });
});
