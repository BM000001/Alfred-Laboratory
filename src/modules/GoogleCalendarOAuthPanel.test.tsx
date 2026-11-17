import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoogleCalendarOAuthPanel } from './GoogleCalendarOAuthPanel';

const mocks = vi.hoisted(() => ({
  authorized: false,
  client: {
    connected: vi.fn(), canWrite: vi.fn(), connect: vi.fn(), calendars: vi.fn(), snapshot: vi.fn(), disconnect: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(),
  },
  agenda: { upsertImported: vi.fn(), reconcileImportedCalendar: vi.fn() },
}));
vi.mock('./agenda/googleCalendar', () => ({ createGoogleCalendarClient: () => mocks.client, loadGoogleIdentity: vi.fn() }));
vi.mock('./agenda/agendaService', () => ({ createAgendaService: () => mocks.agenda }));

beforeEach(() => {
  vi.clearAllMocks(); window.localStorage.clear(); mocks.authorized = false;
  mocks.client.connected.mockImplementation(() => mocks.authorized);
  mocks.client.canWrite.mockReturnValue(false);
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
  it('remembers selected calendar IDs across remounts without saving a token', async () => {
    const first = render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    fireEvent.click(screen.getByLabelText('Estudos'));
    await waitFor(() => expect(window.localStorage.getItem('alfred.googleCalendarIds')).toContain('calendar'));
    first.unmount();
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de calendários' }));
    await screen.findByLabelText('Estudos');
    expect(screen.getByLabelText('Estudos')).toBeChecked();
    expect(JSON.stringify(window.localStorage)).not.toContain('test-token');
  });
  it('preserves selected calendars when refreshing the list', async () => {
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    fireEvent.click(screen.getByLabelText('Estudos'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de calendários' }));
    await waitFor(() => expect(mocks.client.calendars).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Estudos')).toBeChecked();
  });
  it('offers foreground-only auto sync without reconnecting or making Google writes', async () => {
    mocks.client.snapshot.mockResolvedValue({ events: [], calendarIds: ['google:calendar'], from: '2026-11-17T00:00:00.000Z', to: '2027-02-15T00:00:00.000Z' });
    mocks.agenda.reconcileImportedCalendar.mockResolvedValue(0);
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    expect(screen.getByLabelText(/Atualizar automaticamente enquanto o Alfred estiver aberto/)).toBeChecked();
    fireEvent.click(screen.getByLabelText('Estudos'));
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar selecionados' }));
    await waitFor(() => expect(mocks.client.snapshot).toHaveBeenCalledTimes(1));
    await screen.findByText(/Última sincronização Google/);
    expect(mocks.client.connect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Não funciona com o app fechado/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Atualizar automaticamente enquanto o Alfred estiver aberto/));
    expect(screen.getByLabelText(/Atualizar automaticamente enquanto o Alfred estiver aberto/)).not.toBeChecked();
  });
  it('keeps write permission optional and separate from read-only connection', async () => {
    render(<GoogleCalendarOAuthPanel onImported={vi.fn()} />);
    await connect();
    fireEvent.click(screen.getByText('Gerenciar eventos no Google (opcional)'));
    expect(screen.getByRole('button', { name: 'Autorizar criação e edição no Google' })).toBeEnabled();
    expect(mocks.client.createEvent).not.toHaveBeenCalled();
    expect(mocks.client.updateEvent).not.toHaveBeenCalled();
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
