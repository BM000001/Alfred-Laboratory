import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

vi.mock('../modules/agenda/googleCalendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/agenda/googleCalendar')>();
  return { ...actual, createGoogleCalendarClient: () => actual.createGoogleCalendarClient((...args) => fetch(...args)) };
});

afterEach(() => {
  localStorage.clear();
  delete window.google;
  vi.unstubAllGlobals();
});

it('guarda a dispensa do convite para outras visitas', () => {
  const view = render(<App />);
  const invite = screen.getByRole('complementary', { name: 'Convite do Google Calendar' });
  fireEvent.click(within(invite).getByRole('button', { name: 'Agora não' }));
  expect(invite).not.toBeInTheDocument();
  view.unmount();
  render(<App />);
  expect(screen.queryByRole('complementary', { name: 'Convite do Google Calendar' })).not.toBeInTheDocument();
});

it('encaminha ao OAuth existente e só oculta o convite após autenticação real da sessão', async () => {
  const requestAccessToken = vi.fn();
  const revoke = vi.fn((_token, callback) => callback({ successful: true }));
  window.google = { accounts: { oauth2: {
    initTokenClient: ({ scope, callback }) => ({ requestAccessToken: () => {
      requestAccessToken();
      callback({ access_token: 'token-sintetico', scope, expires_in: 300 });
    } }),
    revoke,
  } } };
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [] })));
  vi.stubGlobal('fetch', fetcher);
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
  expect(screen.getByRole('heading', { name: 'Google Calendar' })).toHaveFocus();
  fireEvent.click(screen.getByText('Configurar conexão Google'));
  fireEvent.change(screen.getByLabelText('Client ID público'), { target: { value: 'cliente-de-teste.apps.googleusercontent.com' } });
  expect(screen.getByText('Desconectado')).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }));
  expect(await screen.findByText('Sessão conectada')).toBeVisible();
  expect(requestAccessToken).toHaveBeenCalledOnce();
  expect(screen.queryByText(/sincronização concluída|evento\(s\) sincronizado/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
  expect(screen.queryByRole('complementary', { name: 'Convite do Google Calendar' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
  fireEvent.click(screen.getByRole('button', { name: 'Conexões de calendário' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desconectar Google' }));
  await screen.findByText('Desconectado');
  fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
  expect(screen.getByRole('complementary', { name: 'Convite do Google Calendar' })).toBeVisible();
});

it('leva a escolha de cidade ou localização às Configurações', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Configurar previsão' }));
  expect(screen.getByRole('heading', { name: 'Previsão do tempo' })).toHaveFocus();
  const modes = screen.getByRole('group', { name: 'Origem da previsão' });
  expect(within(modes).getByRole('button', { name: 'Cidade fixa' })).toBeEnabled();
  expect(within(modes).getByRole('button', { name: 'Localização automática' })).toBeEnabled();
});
