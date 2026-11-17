import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoogleCalendarOAuthPanel } from './GoogleCalendarOAuthPanel';

const mocks = vi.hoisted(() => ({
  authorized: false,
  client: {
    connected: vi.fn(), connect: vi.fn(), calendars: vi.fn(), snapshot: vi.fn(), disconnect: vi.fn(),
  },
  agenda: { upsertImported: vi.fn(), reconcileImportedCalendar: vi.fn() },
}));
vi.mock('./agenda/googleCalendar', () => ({ createGoogleCalendarClient: () => mocks.client, loadGoogleIdentity: vi.fn() }));
vi.mock('./agenda/agendaService', () => ({ createAgendaService: () => mocks.agenda }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.authorized = false;
  mocks.client.connected.mockImplementation(() => mocks.authorized);
  mocks.client.connect.mockImplementation(async () => { mocks.authorized = true; });
  mocks.client.calendars.mockResolvedValue([{ id: 'calendar', summary: 'Estudos' }]);
  window.google = { accounts: { oauth2: { initTokenClient: vi.fn(), revoke: vi.fn() } } };
});
afterEach(() => { cleanup(); delete window.google; });
async function connect() {
  fireEvent.change(screen.getByLabelText('Client ID público'), { target: { value: 'public-client.apps.googleusercontent.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }));
  await screen.findByLabelText('Estudos');
}

describe('Google Calendar panel', () => {
  it('retains the public client configuration when returning to Agenda during a connected session', async () => {
    const first = render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    first.unmount();
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    const refresh = screen.getByRole('button', { name: 'Atualizar lista de calendários' });
    expect(refresh).toBeEnabled();
    fireEvent.click(refresh);
    await screen.findByLabelText('Estudos');
    expect(mocks.client.connect).toHaveBeenCalledTimes(1);
  });
  it('preserves selected calendars when refreshing the list', async () => {
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    fireEvent.click(screen.getByLabelText('Estudos'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de calendários' }));
    await waitFor(() => expect(mocks.client.calendars).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Estudos')).toBeChecked();
  });
  it('does not write or archive local events if reading the selected calendars fails', async () => {
    mocks.client.snapshot.mockRejectedValueOnce(new Error('Leitura incompleta'));
    const onImported = vi.fn();
    render(<GoogleCalendarOAuthPanel onImported={onImported} />);
    await connect();
    fireEvent.click(screen.getByLabelText('Estudos'));
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar selecionados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Leitura incompleta');
    expect(mocks.agenda.upsertImported).not.toHaveBeenCalled();
    expect(mocks.agenda.reconcileImportedCalendar).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });
});
