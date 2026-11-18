import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('abre os formulários existentes pelo + e mantém a tarefa ao remontar', async () => {
  const show = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: show },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
  const view = render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
  expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual(['Hoje', 'Aprender', '+', 'Organização', 'Alfred']);
  fireEvent.click(within(nav).getByRole('button', { name: 'Criar' }));
  expect(show).toHaveBeenCalledOnce();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nova tarefa' }));
  const title = await screen.findByLabelText('Título');
  expect(title).toHaveFocus();
  fireEvent.change(title, { target: { value: 'Tarefa do atalho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }));
  await screen.findByText('Alterações salvas.');
  fireEvent.click(within(nav).getByRole('button', { name: 'Criar' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Novo compromisso' }));
  expect(screen.getByRole('button', { name: 'Salvar compromisso' })).toBeInTheDocument();
  view.unmount();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Organização' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver sem data' }));
  expect(await screen.findByRole('button', { name: 'Tarefa do atalho' })).toBeInTheDocument();
});

it('respeita a preferência automática do sistema e persiste a ocultação do mascote', () => {
  let change: () => void = () => {};
  const system = { matches: true, addEventListener: (_type: string, listener: () => void) => { change = listener; }, removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => system);
  const view = render(<App />);
  expect(document.documentElement.dataset.theme).toBe('dark');
  system.matches = false;
  change();
  expect(document.documentElement.dataset.theme).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar mascote Alfred' }));
  view.unmount();
  render(<App />);
  expect(screen.queryByRole('button', { name: 'Abrir assistente Alfred' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Alfred' }));
  expect(screen.queryByRole('img', { name: /Alfred:/ })).not.toBeInTheDocument();
});
