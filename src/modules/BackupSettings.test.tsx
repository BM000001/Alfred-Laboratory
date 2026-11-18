import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BackupSettings } from './BackupSettings';
import { createBackup } from './backup/backupService';
import { encryptBackup } from './backup/encryptedBackup';

vi.mock('./backup/backupService', async (importOriginal) => ({
  ...await importOriginal<typeof import('./backup/backupService')>(), createBackup: vi.fn(),
}));
vi.mock('./backup/encryptedBackup', async (importOriginal) => ({
  ...await importOriginal<typeof import('./backup/encryptedBackup')>(), encryptBackup: vi.fn(),
}));

const limit = 100 * 1024 * 1024;
const sizeError = 'O backup excede o limite de 100 MiB.';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  [limit, true],
  [limit + 1, false],
])('aplica o limite de importação de %i bytes antes de ler', async (size, accepted) => {
  render(<BackupSettings />);
  const text = vi.fn().mockResolvedValue('{');
  fireEvent.change(screen.getByLabelText('Selecionar arquivo de backup'), { target: { files: [{ size, text }] } });
  expect(await screen.findByRole('alert')).toHaveTextContent(accepted ? 'JSON válido' : sizeError);
  expect(text).toHaveBeenCalledTimes(accepted ? 1 : 0);
});

it.each([
  [false, limit, true], [false, limit + 1, false],
  [true, limit, true], [true, limit + 1, false],
])('aplica o limite ao arquivo final (criptografado=%s, bytes=%i)', async (encrypted, size, accepted) => {
  const createObjectURL = vi.fn().mockReturnValue('blob:backup-de-teste');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const finalContent = 'á'.repeat(limit / 2) + (accepted ? '' : 'x');
  vi.mocked(createBackup).mockResolvedValueOnce(encrypted ? 'JSON antes da criptografia' : finalContent);
  if (encrypted) vi.mocked(encryptBackup).mockResolvedValueOnce(finalContent);
  render(<BackupSettings />);
  if (encrypted) {
    fireEvent.change(screen.getByLabelText(/Senha \(mínimo/), { target: { value: 'senha-sintetica-123' } });
    fireEvent.change(screen.getByLabelText('Confirme a senha'), { target: { value: 'senha-sintetica-123' } });
  }
  fireEvent.click(screen.getByRole('button', { name: encrypted ? 'Exportar backup criptografado' : 'Exportar backup JSON' }));
  if (accepted) {
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(createObjectURL.mock.calls[0][0].size).toBe(size);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledOnce(), { timeout: 2000 });
  } else {
    expect(await screen.findByRole('alert')).toHaveTextContent(sizeError);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  }
  expect(encryptBackup).toHaveBeenCalledTimes(encrypted ? 1 : 0);
}, 15_000);
