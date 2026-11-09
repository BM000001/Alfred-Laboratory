import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './Assistant';
import { assistantMessageRepository } from '../storage/repositories';

beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await assistantMessageRepository.clear();
});

describe('Assistant long message', () => {
  it('preserva integralmente uma mensagem longa dentro do limite do campo', async () => {
    const user = userEvent.setup();
    const message = 'Quero organizar meus estudos. ' + 'Revisar os assuntos da semana. '.repeat(14);
    expect(message.length).toBeLessThanOrEqual(500);
    expect(message.length).toBeGreaterThan(400);

    render(<Assistant />);
    const prompt = screen.getByRole('textbox', { name: 'Mensagem para Alfred' });
    await waitFor(() => expect(prompt).toBeEnabled());

    fireEvent.change(prompt, { target: { value: message } });
    expect(prompt).toHaveValue(message);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await within(screen.getByRole('log')).findByText(message, { exact: true })).toBeInTheDocument();
    await waitFor(async () => {
      expect((await assistantMessageRepository.getAll()).some((entry) =>
        entry.role === 'user' && entry.content === message,
      )).toBe(true);
    });
    expect(prompt).toHaveValue('');
  });
});
